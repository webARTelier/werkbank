document.addEventListener('DOMContentLoaded', function () {
  function getQrApiUrl() {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(window.location.href)}`;
  }

  const qrToggle = document.createElement('button');
  qrToggle.classList.add('devQrCodeToggle');
  qrToggle.type = 'button';
  qrToggle.title = 'QR-Code zur aktuellen Seite anzeigen';
  qrToggle.setAttribute('aria-label', 'QR-Code zur aktuellen Seite anzeigen');
  qrToggle.setAttribute('aria-expanded', 'false');
  qrToggle.innerHTML = [
    '<svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">',
    '<path d="M2 2h6v6H2V2Zm2 2v2h2V4H4Zm8-2h6v6h-6V2Zm2 2v2h2V4h-2ZM2 12h6v6H2v-6Zm2 2v2h2v-2H4Zm9-4h2v2h-2v-2Zm3 0h2v3h-2v-3Zm-6 3h2v5h-2v-5Zm4 1h4v2h-4v-2Zm2 3h2v1h-2v-1Zm-3 0h2v1h-2v-1Z" fill="currentColor"/>',
    '</svg>',
  ].join('');

  qrToggle.style.cssText = 'position: fixed; left: 0; bottom: 0; z-index: 99999; width: 20px; height: 20px; padding: 3px; border: 0; color: white; background-color: black; opacity: 0.6; cursor: pointer';

  const qrPanel = document.createElement('div');
  qrPanel.classList.add('devQrCodePanel');
  qrPanel.hidden = true;
  qrPanel.style.cssText = 'position: fixed; left: 0; bottom: 24px; z-index: 99999; padding: 10px; color: white; background-color: rgba(0, 0, 0, 0.9)';

  const qrImage = document.createElement('img');
  qrImage.referrerPolicy = 'no-referrer';
  qrImage.decoding = 'async';
  qrImage.width = 220;
  qrImage.height = 220;
  qrImage.alt = 'QR-Code zur aktuellen Seite';
  qrImage.style.cssText = 'display: block; width: 220px; height: 220px; background: white';

  qrPanel.appendChild(qrImage);
  document.body.appendChild(qrToggle);
  document.body.appendChild(qrPanel);

  qrToggle.addEventListener('click', function () {
    const isHidden = qrPanel.hidden;
    if (isHidden) {
      qrImage.src = getQrApiUrl();
    }
    qrPanel.hidden = !isHidden;
    qrToggle.setAttribute('aria-expanded', String(isHidden));
    qrToggle.title = isHidden ? 'QR-Code ausblenden' : 'QR-Code zur aktuellen Seite anzeigen';
    qrToggle.setAttribute('aria-label', qrToggle.title);
  });
});
