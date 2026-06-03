import React, { useState, useEffect, useRef } from "react";
import { fetchApi } from "../lib/api";
import { Send, Users, Globe, MessageCircle, Trash2, Smile, Search, Paperclip, Download, FileText, Reply, X, Volume2 } from "lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface Message {
  id: number;
  content: string;
  created_at: string;
  sender_id: number;
  sender_username: string;
  sender_role: string;
  recipient_id?: number;
  is_read?: number;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  reply_to?: number;
  reply_content?: string;
  reply_username?: string;
}

interface Reaction {
  message_id: number;
  emoji: string;
  user_id: number;
  username: string;
}

interface ChatUser {
  id: number;
  username: string;
  role: string;
  unread_count: number;
}

interface ChatProps {
  user: { id: number; username: string; role: string };
}

export default function Chat({ user }: ChatProps) {
  const [activeTab, setActiveTab] = useState<"global" | "private">("global");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<{user_id: number, username: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const gifPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // Public API key for demo
  const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

  // Initialize notification sound
  useEffect(() => {
    notificationSound.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6WjHhxeIOPm5+ZjHlwdYKQnZ+ZjHdvdIGPnJ+ajnlwd4OQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudIGOnJ6ZjnlweIOQnJ6YjHZudA==");
  }, []);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      // Load trending GIFs
      setGifsLoading(true);
      try {
        const res = await fetch(`https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20`);
        const data = await res.json();
        setGifs(data.results || []);
      } catch (err) {
        console.error("Error loading trending GIFs:", err);
      } finally {
        setGifsLoading(false);
      }
      return;
    }
    
    setGifsLoading(true);
    try {
      const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20`);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error("Error searching GIFs:", err);
    } finally {
      setGifsLoading(false);
    }
  };

  const selectGif = (gifUrl: string) => {
    setNewMessage(prev => prev + (prev ? " " : "") + gifUrl);
    setShowGifPicker(false);
    setGifSearch("");
  };

  // Load trending GIFs when picker opens
  useEffect(() => {
    if (showGifPicker) {
      searchGifs("");
    }
  }, [showGifPicker]);

  // Live search GIFs with debounce
  useEffect(() => {
    if (!showGifPicker) return;
    const timer = setTimeout(() => {
      searchGifs(gifSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [gifSearch, showGifPicker]);

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (gifPickerRef.current && !gifPickerRef.current.contains(event.target as Node)) {
        setShowGifPicker(false);
      }
      setShowReactionPicker(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Heartbeat for online status
  useEffect(() => {
    const sendHeartbeat = () => {
      fetchApi("/api/chat/heartbeat", { method: "POST" }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch online users
  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const data = await fetchApi("/api/chat/online");
        setOnlineUsers(data);
      } catch (err) {}
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch reactions when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const ids = messages.map(m => m.id).join(',');
      fetchApi(`/api/chat/reactions/${ids}`)
        .then(setReactions)
        .catch(() => {});
    }
  }, [messages]);

  // Play sound on new private message
  useEffect(() => {
    if (activeTab === "private" && messages.length > lastMessageCount && lastMessageCount > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender_id !== user.id && soundEnabled) {
        notificationSound.current?.play().catch(() => {});
      }
    }
    setLastMessageCount(messages.length);
  }, [messages, activeTab, soundEnabled, user.id, lastMessageCount]);

  // Fetch typing users
  useEffect(() => {
    const fetchTyping = async () => {
      try {
        const data = await fetchApi("/api/chat/typing");
        setTypingUsers(data);
      } catch (err) {}
    };
    const interval = setInterval(fetchTyping, 2000);
    return () => clearInterval(interval);
  }, []);

  // Send typing status
  const sendTypingStatus = async (isTyping: boolean) => {
    try {
      await fetchApi("/api/chat/typing", {
        method: "POST",
        body: JSON.stringify({ 
          isTyping, 
          typingTo: activeTab === "private" && selectedUser ? selectedUser.id : null 
        })
      });
    } catch (err) {}
  };

  // Search messages
  const searchMessages = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const recipientId = activeTab === "private" && selectedUser ? selectedUser.id : undefined;
      const url = recipientId 
        ? `/api/chat/search?q=${encodeURIComponent(searchQuery)}&recipientId=${recipientId}`
        : `/api/chat/search?q=${encodeURIComponent(searchQuery)}`;
      const results = await fetchApi(url);
      setSearchResults(results);
    } catch (err) {}
  };

  const addReaction = async (messageId: number, emoji: string) => {
    try {
      await fetchApi(`/api/chat/reaction/${messageId}`, {
        method: "POST",
        body: JSON.stringify({ emoji })
      });
      // Pobierz wszystkie reakcje ponownie z serwera
      if (messages.length > 0) {
        const ids = messages.map(m => m.id).join(',');
        const updatedReactions = await fetchApi(`/api/chat/reactions/${ids}`);
        setReactions(updatedReactions);
      }
      setShowReactionPicker(null);
    } catch (err) {
      console.error("Error adding reaction:", err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      alert("Plik jest za duży (max 10MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const result = await fetchApi("/api/chat/upload", {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            fileData: base64,
            fileType: file.type
          })
        });
        setNewMessage(prev => prev + (prev ? " " : "") + result.fileUrl);
      } catch (err) {
        alert("Błąd podczas wysyłania pliku");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "global") {
      loadGlobalMessages();
      const interval = setInterval(loadGlobalMessages, 5000);
      return () => clearInterval(interval);
    } else {
      loadUsers();
      const interval = setInterval(loadUsers, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedUser) {
      loadPrivateMessages(selectedUser.id);
      const interval = setInterval(() => loadPrivateMessages(selectedUser.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadGlobalMessages = async () => {
    try {
      const data = await fetchApi("/api/chat/global");
      setMessages(data);
    } catch (err) {
      console.error("Error loading global messages:", err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await fetchApi("/api/chat/users");
      setUsers(data);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const loadPrivateMessages = async (userId: number) => {
    try {
      const data = await fetchApi(`/api/chat/private/${userId}`);
      setMessages(data);
      // Refresh users to update unread count
      loadUsers();
    } catch (err) {
      console.error("Error loading private messages:", err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    try {
      const endpoint = activeTab === "global" 
        ? "/api/chat/global" 
        : `/api/chat/private/${selectedUser?.id}`;
      
      const message = await fetchApi(endpoint, {
        method: "POST",
        body: JSON.stringify({ 
          content: newMessage,
          replyTo: replyTo?.id || null
        }),
      });
      
      setMessages(prev => [...prev, message]);
      setNewMessage("");
      setReplyTo(null);
      sendTypingStatus(false);
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      sendTypingStatus(true);
    } else {
      sendTypingStatus(false);
    }
  };

  const deleteConversation = async () => {
    if (!confirm("Czy na pewno chcesz usunąć całą konwersację?")) return;
    
    try {
      const endpoint = activeTab === "global" 
        ? "/api/chat/global" 
        : `/api/chat/private/${selectedUser?.id}`;
      
      await fetchApi(endpoint, { method: "DELETE" });
      setMessages([]);
    } catch (err) {
      console.error("Error deleting conversation:", err);
    }
  };

  const deleteMessage = async (messageId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć tę wiadomość?")) return;
    
    try {
      await fetchApi(`/api/chat/message/${messageId}`, { method: "DELETE" });
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("pl-PL", { 
      day: "2-digit", 
      month: "2-digit",
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrator",
      foreman: "Brygadzista",
      mistrz: "Mistrz",
      guest: "Gość"
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "text-purple-600",
      foreman: "text-blue-600",
      mistrz: "text-green-600",
      guest: "text-gray-500"
    };
    return colors[role] || "text-gray-600";
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header with tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <MessageCircle className="text-blue-600" />
            Czat
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab("global"); setSelectedUser(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "global"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Globe size={18} />
              Globalny
            </button>
            <button
              onClick={() => setActiveTab("private")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "private"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Users size={18} />
              Prywatny
              {users.reduce((sum, u) => sum + u.unread_count, 0) > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {users.reduce((sum, u) => sum + u.unread_count, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Users list (only for private chat) */}
        {activeTab === "private" && (
          <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <h3 className="font-medium text-gray-700">Użytkownicy</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                    selectedUser?.id === u.id
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          onlineUsers.includes(u.id) ? "bg-green-500" : "bg-gray-400"
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{u.username}</p>
                        <p className={`text-xs ${getRoleColor(u.role)}`}>
                          {getRoleLabel(u.role)}
                        </p>
                      </div>
                    </div>
                    {u.unread_count > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {u.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-0">
          {activeTab === "private" && !selectedUser ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Users size={48} className="mx-auto mb-2 opacity-50" />
                <p>Wybierz użytkownika, aby rozpocząć rozmowę</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages header */}
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-700">
                    {activeTab === "global" 
                      ? "Czat globalny - wszyscy użytkownicy" 
                      : `Rozmowa z ${selectedUser?.username}`}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`p-1.5 rounded-lg transition-colors ${soundEnabled ? "text-blue-600 bg-blue-50" : "text-gray-400 hover:bg-gray-100"}`}
                      title={soundEnabled ? "Wyłącz dźwięk" : "Włącz dźwięk"}
                    >
                      <Volume2 size={18} />
                    </button>
                    <button
                      onClick={() => setShowSearch(!showSearch)}
                      className={`p-1.5 rounded-lg transition-colors ${showSearch ? "text-blue-600 bg-blue-50" : "text-gray-400 hover:bg-gray-100"}`}
                      title="Szukaj w wiadomościach"
                    >
                      <Search size={18} />
                    </button>
                    {user.role === "admin" && messages.length > 0 && (
                      <button
                        onClick={deleteConversation}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Usuń całą konwersację"
                      >
                        <Trash2 size={16} />
                        Usuń wszystko
                      </button>
                    )}
                  </div>
                </div>
                {/* Search bar */}
                {showSearch && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchMessages()}
                      placeholder="Szukaj wiadomości..."
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={searchMessages}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Szukaj
                    </button>
                  </div>
                )}
                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-2 space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500">Znaleziono: {searchResults.length}</span>
                      <button onClick={() => { setSearchResults([]); setSearchQuery(""); }} className="text-xs text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </div>
                    {searchResults.map(r => (
                      <div key={r.id} className="text-sm p-2 bg-white rounded border border-gray-100">
                        <span className="font-medium text-gray-700">{r.sender_username}:</span>{" "}
                        <span className="text-gray-600">{r.content.substring(0, 100)}{r.content.length > 100 ? "..." : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    Brak wiadomości. Rozpocznij rozmowę!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.sender_id === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}
                      >
                        <div className={`flex items-end gap-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              isOwn
                                ? "bg-blue-600 text-white rounded-br-md"
                                : "bg-gray-100 text-gray-800 rounded-bl-md"
                            }`}
                          >
                            {!isOwn && (
                              <p className={`text-xs font-medium mb-1 ${
                                isOwn ? "text-blue-200" : getRoleColor(msg.sender_role)
                              }`}>
                                {msg.sender_username}
                              </p>
                            )}
                            {/* Quoted message */}
                            {msg.reply_to && msg.reply_content && (
                              <div className={`text-xs mb-2 p-2 rounded-lg border-l-2 ${
                                isOwn ? "bg-blue-500/30 border-blue-300" : "bg-gray-200 border-gray-400"
                              }`}>
                                <span className="font-medium">{msg.reply_username}:</span>{" "}
                                <span className="opacity-80">{msg.reply_content.substring(0, 50)}{msg.reply_content.length > 50 ? "..." : ""}</span>
                              </div>
                            )}
                            {msg.content.match(/\/api\/chat\/file\//) ? (
                              <div className="space-y-2">
                                {msg.content.split(/(\s+)/).map((part, i) => 
                                  part.match(/\/api\/chat\/file\//) ? (
                                    part.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                      <img key={i} src={part} alt="Załącznik" className="max-w-xs rounded-lg" />
                                    ) : (
                                      <a key={i} href={part} download className={`flex items-center gap-2 p-2 rounded-lg ${isOwn ? "bg-blue-500" : "bg-gray-200"}`}>
                                        <FileText size={20} />
                                        <span className="text-sm">Pobierz plik</span>
                                        <Download size={16} />
                                      </a>
                                    )
                                  ) : part.trim() ? (
                                    <span key={i}>{part}</span>
                                  ) : null
                                )}
                              </div>
                            ) : msg.content.match(/https?:\/\/[^\s]+\.(gif|png|jpg|jpeg|webp)/gi) ? (
                              <div className="space-y-2">
                                {msg.content.split(/(\s+)/).map((part, i) => 
                                  part.match(/https?:\/\/[^\s]+\.(gif|png|jpg|jpeg|webp)/i) ? (
                                    <img key={i} src={part} alt="GIF" className="max-w-xs rounded-lg" />
                                  ) : part.trim() ? (
                                    <span key={i}>{part}</span>
                                  ) : null
                                )}
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words min-w-[60px]">{msg.content}</p>
                            )}
                            {/* Reactions display */}
                            {reactions.filter(r => r.message_id === msg.id).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2 -mb-1">
                                {Object.entries(
                                  reactions.filter(r => r.message_id === msg.id)
                                    .reduce((acc, r) => {
                                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                      return acc;
                                    }, {} as Record<string, number>)
                                ).map(([emoji, count]) => (
                                  <span key={emoji} className={`text-sm rounded-full px-2 py-0.5 ${
                                    isOwn ? "bg-blue-500/50" : "bg-gray-200"
                                  }`}>
                                    {emoji} {(count as number) > 1 ? count : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className={`text-xs mt-1 ${
                              isOwn ? "text-blue-200" : "text-gray-400"
                            }`}>
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                          {/* Action buttons */}
                          <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-all ${isOwn ? "flex-row-reverse" : ""}`}>
                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id); }}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-all"
                                title="Dodaj reakcję"
                              >
                                <Smile size={14} />
                              </button>
                              {showReactionPicker === msg.id && (
                                <div 
                                  className="absolute bottom-6 left-0 bg-white rounded-lg shadow-lg border p-2 flex gap-1"
                                  style={{ zIndex: 9999 }}
                                >
                                  {REACTION_EMOJIS.map(emojiChar => (
                                    <span
                                      key={emojiChar}
                                      role="button"
                                      tabIndex={0}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("Reaction selected:", emojiChar);
                                        addReaction(msg.id, emojiChar);
                                      }}
                                      className="hover:bg-gray-100 rounded p-1.5 text-xl cursor-pointer select-none"
                                      style={{ userSelect: 'none' }}
                                    >
                                      {emojiChar}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setReplyTo(msg)}
                              className="p-1 text-gray-400 hover:text-blue-500 transition-all"
                              title="Odpowiedz"
                            >
                              <Reply size={14} />
                            </button>
                            {user.role === "admin" && (
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-all"
                                title="Usuń wiadomość"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="text-sm text-gray-500 italic pl-2">
                    {typingUsers.map(t => t.username).join(", ")} pisze...
                  </div>
                )}
              </div>

              {/* Message input */}
              <form onSubmit={sendMessage} className="p-3 border-t border-gray-100">
                {/* Reply preview */}
                {replyTo && (
                  <div className="mb-2 p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Reply size={16} className="text-blue-500" />
                      <span className="text-gray-500">Odpowiadasz na:</span>
                      <span className="font-medium">{replyTo.sender_username}:</span>
                      <span className="text-gray-600 truncate max-w-xs">{replyTo.content.substring(0, 40)}{replyTo.content.length > 40 ? "..." : ""}</span>
                    </div>
                    <button type="button" onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2 relative">
                  <div className="relative" ref={emojiPickerRef}>
                    <button
                      type="button"
                      onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                      className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <Smile size={22} />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 z-50">
                        <EmojiPicker onEmojiClick={onEmojiClick} width={300} height={400} />
                      </div>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                      title="Załącz plik"
                    >
                      <Paperclip size={22} />
                    </button>
                  </div>
                  <div className="relative" ref={gifPickerRef}>
                    <button
                      type="button"
                      onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                      className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-bold text-sm"
                    >
                      GIF
                    </button>
                    {showGifPicker && (
                      <div className="absolute bottom-12 left-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 w-96">
                        <div className="p-2 border-b border-gray-100">
                          <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={gifSearch}
                              onChange={(e) => setGifSearch(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && searchGifs(gifSearch)}
                              placeholder="Szukaj GIF..."
                              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => searchGifs(gifSearch)}
                            className="mt-2 w-full py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                          >
                            Szukaj
                          </button>
                        </div>
                        <div className="h-96 overflow-y-auto p-3 space-y-3">
                          {gifsLoading ? (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              Ładowanie...
                            </div>
                          ) : gifs.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              Brak wyników
                            </div>
                          ) : (
                            gifs.map((gif: any) => (
                              <button
                                key={gif.id}
                                type="button"
                                onClick={() => selectGif(gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url)}
                                className="w-full rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all block bg-gray-100"
                              >
                                <img
                                  src={gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url}
                                  alt={gif.content_description}
                                  className="w-full h-auto max-h-48"
                                />
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder="Napisz wiadomość..."
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
