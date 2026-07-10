(() => {
  'use strict';

  const SCALES = {
    pentatonic: ['C3','D3','E3','G3','A3','C4','D4','E4','G4','A4','C5','D5','E5','G5','A5','C6'],
    major: ['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5','A5','B5','C6'],
    chromatic: (() => {
      const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const out = [];
      for (let oct = 3; oct <= 6; oct++) {
        for (const n of names) {
          out.push(n + oct);
          if (oct === 6 && n === 'C') return out;
        }
      }
      return out;
    })()
  };

  const el = id => document.getElementById(id);
  const pnlInput = el('pnl-input');
  const dropzone = el('dropzone');
  const fileInput = el('file-input');
  const browseBtn = el('browse-btn');
  const dzStatus = el('dz-status');
  const scaleSelect = el('scale-select');
  const tempoSlider = el('tempo');
  const tempoOut = el('tempo-out');
  const autoscale = el('autoscale');
  const rangeReadout = el('range-readout');
  const playBtn = el('play-btn');
  const playLabel = el('play-label');
  const viz = el('viz');
  const tradeCount = el('trade-count');

  let synth = null;
  let isPlaying = false;

  function parsePnl(text) {
    return text.split(/[,\n]/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
  }

  function currentScale() {
    return SCALES[scaleSelect.value] || SCALES.pentatonic;
  }

  function getBounds(values) {
    if (autoscale.checked && values.length) {
      let lo = Math.min(...values), hi = Math.max(...values);
      if (lo === hi) { lo -= 1; hi += 1; }
      return { lo, hi };
    }
    return { lo: -5, hi: 5 };
  }

  function pnlToIndex(v, lo, hi, scaleLen) {
    const clamped = Math.max(lo, Math.min(hi, v));
    const t = (clamped - lo) / (hi - lo);
    return Math.round(t * (scaleLen - 1));
  }

  function render() {
    const values = parsePnl(pnlInput.value);
    const scale = currentScale();
    const { lo, hi } = getBounds(values);

    rangeReadout.textContent = values.length
      ? (autoscale.checked
          ? `Biên độ tự co giãn: ${lo.toFixed(2)}% (nốt thấp nhất) — ${hi.toFixed(2)}% (nốt cao nhất)`
          : `Biên độ cố định: -5% (nốt thấp nhất) — +5% (nốt cao nhất)`)
      : 'Nhập dữ liệu để xem biên độ nốt.';

    tradeCount.textContent = `${values.length} lệnh`;
    playBtn.disabled = values.length === 0;

    viz.innerHTML = '';
    values.forEach(v => {
      const idx = pnlToIndex(v, lo, hi, scale.length);
      const heightPct = Math.max(4, (idx / (scale.length - 1)) * 100);
      const bar = document.createElement('div');
      bar.className = 'bar ' + (v >= 0 ? 'gain' : 'loss');
      bar.style.height = heightPct + '%';
      bar.title = v.toFixed(3) + '%';
      viz.appendChild(bar);
    });
  }

  async function play() {
    if (isPlaying) return;
    const values = parsePnl(pnlInput.value);
    if (!values.length) return;

    await Tone.start();
    if (!synth) {
      synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.3 }
      }).toDestination();
    }

    const scale = currentScale();
    const { lo, hi } = getBounds(values);
    const bpm = parseInt(tempoSlider.value, 10);
    const noteDur = 60 / bpm;
    const bars = viz.querySelectorAll('.bar');

    isPlaying = true;
    playBtn.classList.add('playing');
    playLabel.textContent = 'Đang phát...';

    Tone.Transport.cancel();
    values.forEach((v, i) => {
      const note = scale[pnlToIndex(v, lo, hi, scale.length)];
      const time = i * noteDur;
      Tone.Transport.scheduleOnce(t => {
        synth.triggerAttackRelease(note, noteDur * 0.9, t);
        Tone.Draw.schedule(() => {
          bars.forEach(b => b.classList.remove('active'));
          if (bars[i]) bars[i].classList.add('active');
        }, t);
      }, time);
    });

    const totalTime = values.length * noteDur + 0.5;
    Tone.Transport.scheduleOnce(() => {
      stop();
    }, totalTime);

    Tone.Transport.position = 0;
    Tone.Transport.start();
  }

  function stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    isPlaying = false;
    playBtn.classList.remove('playing');
    playLabel.textContent = 'Phát giai điệu';
    viz.querySelectorAll('.bar').forEach(b => b.classList.remove('active'));
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) stop(); else play();
  });

  pnlInput.addEventListener('input', render);
  scaleSelect.addEventListener('change', render);
  autoscale.addEventListener('change', render);
  tempoSlider.addEventListener('input', e => {
    tempoOut.textContent = e.target.value;
  });

  function setStatus(msg, isError) {
    dzStatus.textContent = msg;
    dzStatus.classList.toggle('error', !!isError);
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setStatus('File không hợp lệ — cần file .html xuất từ MT4/MT5 (Trade History Report).', true);
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const html = decodeReportBuffer(buffer);
      const { pnlPercents, tradeCount: n, accountName } = parseMT5Report(html);
      if (!n) {
        setStatus('Đọc được file nhưng không tìm thấy lệnh đã đóng nào.', true);
        return;
      }
      pnlInput.value = pnlPercents.map(v => v.toFixed(3)).join(', ');
      setStatus(`Đã nạp ${n} lệnh${accountName ? ' từ ' + accountName : ''}.`, false);
      render();
    } catch (err) {
      setStatus(err.message || 'Không đọc được file này.', true);
    }
  }

  browseBtn.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag-over'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag-over'); })
  );
  dropzone.addEventListener('drop', e => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(file);
  });

  function buildHeroSignature() {
    const wrap = el('staff-signature');
    const n = 48;
    for (let i = 0; i < n; i++) {
      const bar = document.createElement('div');
      bar.className = 'staff-bar';
      const h = 12 + Math.abs(Math.sin(i * 0.4) * Math.cos(i * 0.15)) * 78;
      const isGain = Math.sin(i * 0.4) >= 0;
      bar.style.height = h + '%';
      bar.style.background = isGain ? 'var(--gain)' : 'var(--loss)';
      wrap.appendChild(bar);
    }
  }

  buildHeroSignature();
  render();
})();
