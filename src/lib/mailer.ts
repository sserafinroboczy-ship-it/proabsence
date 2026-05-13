import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'imcpoland.home.pl',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const logoBase64 = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjUwIiB2aWV3Qm94PSIwIDAgMjAwIDUwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJncmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMxZTNhNWY7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzJkNTI4NjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iNTAiIGZpbGw9InVybCgjZ3JhZCkiIHJ4PSI4Ii8+CiAgPHRleHQgeD0iMTAwIiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPgogICAgPHRzcGFuIGZpbGw9IiM2MGE1ZmEiPlBybzwvdHNwYW4+PHRzcGFuIGZpbGw9IndoaXRlIj5BYnNlbmNlPC90c3Bhbj4KICA8L3RleHQ+Cjwvc3ZnPg==`;

export interface LimitExceededData {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  hallName: string;
  employmentType: string;
  hoursLimit: number;
  hoursUsed: number;
  hoursExceeded: number;
  month: string;
}

export const sendLimitExceededEmail = async (recipients: string[], data: LimitExceededData) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('⚠️ SMTP nie skonfigurowany - pomijam wysyłkę maila');
    return false;
  }

  const fromName = process.env.SMTP_FROM_NAME || 'ProAbsence';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const htmlContent = `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Przekroczenie limitu godzin - ProAbsence</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
          
          <!-- Header z logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5286 100%); padding: 30px 40px; border-radius: 12px 12px 0 0;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                      <span style="color: #60a5fa;">Pro</span><span style="color: #ffffff;">Absence</span>
                    </h1>
                    <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;">System Zarządzania Obecnością</p>
                  </td>
                  <td align="right">
                    <div style="background-color: #ef4444; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                      ⚠️ ALERT
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Treść główna -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #dc2626; font-size: 22px; font-weight: 600;">
                🚨 Przekroczenie limitu godzin
              </h2>
              
              <p style="margin: 0 0 25px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                Pracownik przekroczył dopuszczalny miesięczny limit godzin pracy. Poniżej szczegóły:
              </p>

              <!-- Karta pracownika -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef2f2; border-radius: 10px; border: 1px solid #fecaca; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 25px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding-bottom: 15px; border-bottom: 1px solid #fecaca;">
                          <span style="color: #991b1b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Dane pracownika</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 15px;">
                          <table role="presentation" style="width: 100%;">
                            <tr>
                              <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 140px;">Nr pracownika:</td>
                              <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.employeeNumber || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Imię i nazwisko:</td>
                              <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.firstName} ${data.lastName}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Hala / Wydział:</td>
                              <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.hallName}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Forma zatrudnienia:</td>
                              <td style="padding: 8px 0;">
                                <span style="background-color: ${data.employmentType === 'Agencja' ? '#f97316' : '#8b5cf6'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${data.employmentType}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Statystyki godzin -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                <tr>
                  <td style="width: 33%; padding: 15px; background-color: #f1f5f9; border-radius: 10px 0 0 10px; text-align: center;">
                    <div style="color: #64748b; font-size: 12px; font-weight: 500; margin-bottom: 5px;">LIMIT</div>
                    <div style="color: #1e293b; font-size: 24px; font-weight: 700;">${data.hoursLimit}h</div>
                  </td>
                  <td style="width: 33%; padding: 15px; background-color: #fef3c7; text-align: center;">
                    <div style="color: #92400e; font-size: 12px; font-weight: 500; margin-bottom: 5px;">WYKORZYSTANO</div>
                    <div style="color: #92400e; font-size: 24px; font-weight: 700;">${data.hoursUsed}h</div>
                  </td>
                  <td style="width: 33%; padding: 15px; background-color: #fef2f2; border-radius: 0 10px 10px 0; text-align: center;">
                    <div style="color: #dc2626; font-size: 12px; font-weight: 500; margin-bottom: 5px;">PRZEKROCZONO</div>
                    <div style="color: #dc2626; font-size: 24px; font-weight: 700;">+${data.hoursExceeded}h</div>
                  </td>
                </tr>
              </table>

              <!-- Miesiąc -->
              <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
                📅 Okres rozliczeniowy: <strong style="color: #1e293b;">${data.month}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="color: #94a3b8; font-size: 12px;">
                    <p style="margin: 0 0 5px 0;">Ta wiadomość została wygenerowana automatycznie przez system <strong>ProAbsence</strong>.</p>
                    <p style="margin: 0;">Prosimy nie odpowiadać na tę wiadomość.</p>
                  </td>
                  <td align="right" style="color: #94a3b8; font-size: 11px;">
                    © ${new Date().getFullYear()} ProAbsence
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
PROABSENCE - PRZEKROCZENIE LIMITU GODZIN
========================================

⚠️ ALERT: Pracownik przekroczył dopuszczalny miesięczny limit godzin pracy.

DANE PRACOWNIKA:
- Nr pracownika: ${data.employeeNumber || '-'}
- Imię i nazwisko: ${data.firstName} ${data.lastName}
- Hala / Wydział: ${data.hallName}
- Forma zatrudnienia: ${data.employmentType}

STATYSTYKI GODZIN:
- Limit: ${data.hoursLimit}h
- Wykorzystano: ${data.hoursUsed}h
- Przekroczono: +${data.hoursExceeded}h

Okres rozliczeniowy: ${data.month}

---
Ta wiadomość została wygenerowana automatycznie przez system ProAbsence.
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipients.join(', '),
      subject: `🚨 [ProAbsence] Przekroczenie limitu godzin - ${data.firstName} ${data.lastName}`,
      text: textContent,
      html: htmlContent,
    });
    console.log(`✅ Mail wysłany do: ${recipients.join(', ')}`);
    return true;
  } catch (error) {
    console.error('❌ Błąd wysyłki maila:', error);
    return false;
  }
};

export const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Połączenie SMTP OK');
    return true;
  } catch (error) {
    console.error('❌ Błąd połączenia SMTP:', error);
    return false;
  }
};
