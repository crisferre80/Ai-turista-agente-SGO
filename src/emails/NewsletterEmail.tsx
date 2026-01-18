import React from 'react';

type Article = {
  title: string;
  summary?: string;
  category?: string;
  image_url?: string;
  url?: string;
};

export default function NewsletterEmail({ subscriberName, articles }: { subscriberName?: string; articles: Article[] }) {
  return (
    <html>
      <body style={{ fontFamily: 'Arial, Helvetica, sans-serif', background: '#f5f7fb', margin: 0, padding: 0 }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ background: '#f5f7fb', padding: 20 }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="600" cellPadding={0} cellSpacing={0} style={{ background: '#ffffff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '28px 36px', textAlign: 'center', background: '#0e1f1d', color: '#fff' }}>
                        <h1 style={{ margin: 0, fontSize: 22 }}>Sant IA — Noticias</h1>
                        <p style={{ margin: '6px 0 0 0', color: '#d1d5db' }}>{subscriberName ? `Hola ${subscriberName}!` : 'Hola!'}</p>
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: 24 }}>
                        {articles.map((a, idx) => (
                          <div key={idx} style={{ marginBottom: 20 }}>
                            {a.image_url && (
                              <div style={{ marginBottom: 10 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.image_url} alt={a.title} width="100%" style={{ borderRadius: 8, maxHeight: 240, objectFit: 'cover' }} />
                              </div>
                            )}

                            <h2 style={{ margin: '6px 0 8px 0', fontSize: 18 }}>{a.title}</h2>
                            {a.summary && <p style={{ margin: 0, color: '#4b5563' }}>{a.summary}</p>}
                            {a.url && (
                              <p style={{ marginTop: 8 }}>
                                <a href={a.url} style={{ color: '#1A3A6C', fontWeight: 700, textDecoration: 'none' }}>Leer más →</a>
                              </p>
                            )}
                          </div>
                        ))}

                        <hr style={{ border: 'none', borderTop: '1px solid #eef2f7', margin: '20px 0' }} />

                        <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Gracias por usar Sant IA — tu asistente turístico.</p>
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>© {new Date().getFullYear()} Sant IA</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
