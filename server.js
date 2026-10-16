const express = require('express');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const app = express();
app.use(express.json({ limit: '20mb' }));

// Helper to fetch the official 6000x5800 PNG from remote graph server
async function fetchGraphImage(payload) {
  const res = await fetch('http://88.99.190.15/graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Remote graph server error (${res.status}): ${errText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function drawCardBottom(ctx, left, right, top, bottom, radius, lineWidth, fillColor, strokeColor) {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(left + lineWidth / 2, top);
  ctx.lineTo(left + lineWidth / 2, bottom - radius);
  ctx.quadraticCurveTo(left + lineWidth / 2, bottom - lineWidth / 2, left + radius, bottom - lineWidth / 2);
  ctx.lineTo(right - radius, bottom - lineWidth / 2);
  ctx.quadraticCurveTo(right - lineWidth / 2, bottom - lineWidth / 2, right - lineWidth / 2, bottom - radius);
  ctx.lineTo(right - lineWidth / 2, top);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(left + lineWidth / 2, top);
  ctx.lineTo(left + lineWidth / 2, bottom - radius);
  ctx.quadraticCurveTo(left + lineWidth / 2, bottom - lineWidth / 2, left + radius, bottom - lineWidth / 2);
  ctx.lineTo(right - radius, bottom - lineWidth / 2);
  ctx.quadraticCurveTo(right - lineWidth / 2, bottom - lineWidth / 2, right - lineWidth / 2, bottom - radius);
  ctx.lineTo(right - lineWidth / 2, top);
  ctx.stroke();
  ctx.restore();
}

// Function to patch the footer branding if Natro Branding is OFF
async function processImageBranding(imgBuffer, isNatro) {
  if (isNatro) {
    // If Natro Branding is ON, return the official 100% untouched Natro image!
    return imgBuffer;
  }

  // If Natro Branding is OFF, patch the footer text in the bottom right corner
  const img = await loadImage(imgBuffer);
  const W = img.width;
  const H = img.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const scale = W / 6000;

  const cardLeft = 4415 * scale;
  const cardRight = 5785 * scale;
  const cardWidth = cardRight - cardLeft;
  const centerX = cardLeft + cardWidth / 2;

  const startRowY = 5135 * scale;
  const newBottomY = 5275 * scale;
  const radius = 20 * scale;
  const lineWidth = 10 * scale;

  // 1. Clear footer area below the card first with column background #201e20
  const colLeft = 4320 * scale;
  const colWidth = 1560 * scale;
  const footerStartY = newBottomY - 5 * scale;
  const footerH = H - footerStartY - 10 * scale;

  ctx.fillStyle = '#201e20';
  ctx.fillRect(colLeft, footerStartY, colWidth, footerH);

  // 2. STATS card extension: extend cleanly down to newBottomY
  drawCardBottom(ctx, cardLeft, cardRight, startRowY, newBottomY, radius, lineWidth, '#2c2a2c', '#353335');

  // Redraw the 9th stat row cleanly with full padding!
  const textBaselineY = 5205 * scale;
  ctx.font = 'bold ' + Math.round(58 * scale) + 'px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ccffffff';
  ctx.textAlign = 'right';
  ctx.fillText('Total Windy Kills', centerX - 40 * scale, textBaselineY);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('0', centerX + 40 * scale, textBaselineY);

  // Dash line —
  ctx.fillStyle = '#666666';
  const dashX = centerX + 260 * scale;
  const dashY = textBaselineY - 18 * scale;
  ctx.beginPath();
  ctx.roundRect(dashX, dashY, 50 * scale, 12 * scale, 6 * scale);
  ctx.fill();

  // 3. Draw 3 clean lines requested by user
  // Line 1: kingstawww HUB Analytics v2.3
  ctx.font = 'bold ' + Math.round(58 * scale) + 'px "Segoe UI", sans-serif';
  ctx.fillStyle = '#f5b937';
  ctx.textAlign = 'center';
  const line1Y = newBottomY + 110 * scale;
  ctx.fillText('kingstawww HUB Analytics v2.3', centerX, line1Y);

  // Line 2: Date & Range
  const now = new Date();
  const dStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const hNow = now.getHours();
  const hRange = String(hNow).padStart(2, '0') + ':00 - ' + String((hNow + 1) % 24).padStart(2, '0') + ':00';
  ctx.font = 'bold ' + Math.round(50 * scale) + 'px "Segoe UI", sans-serif';
  ctx.fillStyle = '#f5a623';
  const line2Y = line1Y + 95 * scale;
  ctx.fillText(hRange + ' • ' + dStr, centerX, line2Y);

  // Line 3: discord.gg/kingstawwwhub
  ctx.font = 'bold ' + Math.round(54 * scale) + 'px "Segoe UI", sans-serif';
  ctx.fillStyle = '#58a6ff';
  const line3Y = line2Y + 105 * scale;
  ctx.fillText('discord.gg/kingstawwwhub', centerX, line3Y);

  return canvas.toBuffer('image/png');
}

// 1. Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'kingstawww HUB Natro Graph Server',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 2. Raw PNG render endpoint
app.post('/graph', async (req, res) => {
  try {
    const isNatro = Boolean(req.body && req.body.hidebranding);
    const rawGraphPng = await fetchGraphImage(req.body || {});
    const finalPng = await processImageBranding(rawGraphPng, isNatro);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', finalPng.length);
    res.send(finalPng);
  } catch (err) {
    console.error('Render error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Render and post directly to Discord Webhook
app.post('/graph/message', async (req, res) => {
  try {
    const targetWebhook = req.body && req.body.webhook;
    if (!targetWebhook || !targetWebhook.startsWith('http')) {
      return res.status(400).json({ error: 'Missing or invalid webhook URL' });
    }

    const isNatro = Boolean(req.body && req.body.hidebranding);
    const rawGraphPng = await fetchGraphImage(req.body || {});
    const finalPng = await processImageBranding(rawGraphPng, isNatro);

    let authorName = (req.body && req.body.username) ? String(req.body.username).trim() : '';
    if (!authorName) {
      const customName = req.body && req.body.custom_name ? String(req.body.custom_name).trim() : '';
      const renameEnabled = Boolean(req.body && req.body.rename_enabled);
      const isNatro = Boolean(req.body && req.body.hidebranding);
      const baseName = (renameEnabled && customName.length > 0) ? customName : (isNatro ? "Natro Macro" : "kingstawww HUB");
      const executor = req.body && req.body.executor ? String(req.body.executor).trim() : '';
      authorName = executor ? `${baseName} - ${executor}` : baseName;
    }

    const form = new FormData();
    form.append('payload_json', JSON.stringify({
      username: authorName,
      embeds: [{
        author: { name: authorName },
        image: { url: 'attachment://graph.png' },
        footer: { text: isNatro ? 'discord.gg/natromacro' : 'discord.gg/kingstawwwhub' },
        timestamp: new Date().toISOString()
      }]
    }));
    form.append('files[0]', new Blob([finalPng], { type: 'image/png' }), 'graph.png');

    const discordRes = await fetch(targetWebhook, {
      method: 'POST',
      body: form
    });

    if (discordRes.ok) {
      console.log(`[${new Date().toLocaleTimeString()}] 📊 Successfully rendered & sent official Natro dashboard to Discord! (Author: ${authorName})`);
      return res.status(200).send('OK');
    } else {
      const errText = await discordRes.text();
      console.error(`[${new Date().toLocaleTimeString()}] ⚠️ Discord error:`, discordRes.status, errText);
      return res.status(discordRes.status).send(errText);
    }
  } catch (err) {
    console.error('Relay error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper to fetch honey meter PNG
async function fetchHoneyImage(stats) {
  const res = await fetch('http://88.99.190.15/honey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      honey: Number(stats.honey) || 0,
      pollen: Number(stats.pollen) || 0,
      backpack: Number(stats.backpack) || 1,
      honeypersec: String(stats.honeypersec || '+0/sec'),
      pollenpersec: String(stats.pollenpersec || '+0/sec')
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Remote honey server error (${res.status}): ${errText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// 4. Raw Honey PNG endpoint
app.post('/honey', async (req, res) => {
  try {
    const pngBuf = await fetchHoneyImage(req.body || {});
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuf.length);
    res.send(pngBuf);
  } catch (err) {
    console.error('Honey render error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 5. Honey message endpoint (posts embed + honey PNG to Discord)
app.post('/honey/message', async (req, res) => {
  try {
    const targetWebhook = req.body && req.body.webhook;
    if (!targetWebhook || !targetWebhook.startsWith('http')) {
      return res.status(400).json({ error: 'Missing or invalid webhook URL' });
    }

    const pngBuf = await fetchHoneyImage(req.body || {});
    const authorName = (req.body && req.body.username) ? String(req.body.username).trim() : "kingstawww HUB";
    const embeds = (req.body && Array.isArray(req.body.embeds)) ? req.body.embeds : [];
    if (embeds.length > 0) {
      embeds[0].image = { url: 'attachment://honey.png' };
    }

    const form = new FormData();
    form.append('payload_json', JSON.stringify({
      username: authorName,
      embeds: embeds
    }));
    form.append('files[0]', new Blob([pngBuf], { type: 'image/png' }), 'honey.png');

    const discordRes = await fetch(targetWebhook, {
      method: 'POST',
      body: form
    });

    if (discordRes.ok) {
      console.log(`[${new Date().toLocaleTimeString()}] 🍯 Successfully posted Honey Update to Discord! (Author: ${authorName})`);
      return res.status(200).send('OK');
    } else {
      const errText = await discordRes.text();
      console.error(`[${new Date().toLocaleTimeString()}] ⚠️ Discord error:`, discordRes.status, errText);
      return res.status(discordRes.status).send(errText);
    }
  } catch (err) {
    console.error('Honey relay error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 kingstawww HUB Graph Server is listening on port ${PORT}`);
});
