/* ==========================================================================
   MASTER.JS - Interactive Lyrics & Chord Viewer Engine
   Repository: https://github.com/caitlinfearn03/kpop-lyrics-template
   ========================================================================== */

console.log("[master.js] Engine initialized.");

// 1. STATE & CONFIGURATION
let currentFontScale = 1.0;
let isScrolling = false;
let scrollSpeed = 0;
let scrollAnimationFrame = null;
let lastScrollTimestamp = null;
let currentScrollY = 0;
let transposeSteps = 0;
let activeMemberFilter = null;

// 2. INITIALIZATION (Safe loading & diagnostic engine)
let initRetryCount = 0;
function initApp() {
  if (typeof songData !== 'undefined') {
    buildLyrics();
    updateView();
  } else if (initRetryCount < 20) { // Retry for up to 1 second
    initRetryCount++;
    setTimeout(initApp, 50);
  } else {
    console.error("master.js error: 'songData' variable was not found. Check if songData is defined in HTML or song.js.");
    let container = document.getElementById('lyricsContainer') || document.body;
    if (container) {
      container.innerHTML = '<div style="color: #ff6b6b; text-align: center; padding: 2rem; font-family: sans-serif;">' +
        '<h2>Unable to load song data</h2>' +
        '<p>Please ensure <code>songData</code> is defined in your HTML or <code>song.js</code> file.</p>' +
        '</div>';
    }
  }
}

// Immediate execution fallback if DOMContentLoaded has already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initApp();
} else {
  document.addEventListener('DOMContentLoaded', initApp);
}

// 3. FONT SCALING & SMOOTH SCROLL ENGINE
function changeFontSize(amount) {
  currentFontScale = Math.max(0.6, Math.min(2.0, currentFontScale + amount));
  document.documentElement.style.setProperty('--base-font-scale', currentFontScale);
  const label = document.getElementById('fontSizeLabel');
  if (label) label.textContent = Math.round(currentFontScale * 100) + '%';
  updateView();
}

function toggleAutoScroll() {
  const btn = document.getElementById('scrollBtn');
  if (!btn) return;
  if (isScrolling) {
    if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame = null;
    lastScrollTimestamp = null;
    btn.textContent = "SCROLL";
    btn.classList.remove('active');
    isScrolling = false;
  } else {
    btn.textContent = "STOP";
    btn.classList.add('active');
    isScrolling = true;
    startScrollEngine();
  }
}

function getPixelsPerSecond(speed) {
  if (speed >= 1) {
    return speed * 30; // Speed 1 = 30px/s, Speed 10 = 300px/s
  } else {
    return Math.max(1.5, 20 + (speed * 3.7));
  }
}

function startScrollEngine() {
  if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
  
  currentScrollY = window.scrollY;

  function scrollStep(timestamp) {
    if (!isScrolling) return;

    if (!lastScrollTimestamp) lastScrollTimestamp = timestamp;
    const deltaTime = (timestamp - lastScrollTimestamp) / 1000;
    lastScrollTimestamp = timestamp;

    if (Math.abs(window.scrollY - currentScrollY) > 8) {
      currentScrollY = window.scrollY;
    }

    const pixelsPerSecond = getPixelsPerSecond(scrollSpeed);
    currentScrollY += pixelsPerSecond * deltaTime;

    window.scrollTo(0, currentScrollY);

    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 2) {
      toggleAutoScroll();
      return;
    }

    scrollAnimationFrame = requestAnimationFrame(scrollStep);
  }

  lastScrollTimestamp = performance.now();
  scrollAnimationFrame = requestAnimationFrame(scrollStep);
}

function changeScrollSpeed(amount) {
  scrollSpeed = Math.max(-5, Math.min(10, scrollSpeed + amount));
  const label = document.getElementById('scrollSpeedLabel');
  if (label) label.textContent = scrollSpeed;
}

// 4. CHORD TRANSPOSITION ENGINE
const CHROMATIC_SCALE_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_SCALE_FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transposeChordName(chordName, steps) {
  if (steps === 0) return chordName;
  const rootMatch = chordName.match(/^([A-G][b#]?)(.*)/);
  if (!rootMatch) return chordName;

  const root = rootMatch[1];
  const suffix = rootMatch[2];

  let index = CHROMATIC_SCALE_SHARPS.indexOf(root);
  if (index === -1) {
    index = CHROMATIC_SCALE_FLATS.indexOf(root);
  }
  if (index === -1) return chordName;

  let newIndex = (index + steps) % 12;
  if (newIndex < 0) newIndex += 12;

  const useFlats = root.includes('b') || chordName.includes('b');
  const scale = useFlats ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE_SHARPS;
  return scale[newIndex] + suffix;
}

function transpose(stepsDelta) {
  transposeSteps += stepsDelta;
  const label = document.getElementById('transposeLabel');
  if (label) {
    label.textContent = (transposeSteps > 0 ? '+' : '') + transposeSteps;
  }

  const chords = document.querySelectorAll('.inline-chord');
  chords.forEach(chordEl => {
    const orig = chordEl.getAttribute('data-original-chord');
    if (orig) {
      chordEl.textContent = transposeChordName(orig, transposeSteps);
    }
  });
}

// 5. HELPER UTILITIES & CHORD PARSER
function stripChordTags(htmlStr) {
  return htmlStr.replace(/<[^>]*>/g, '').trim();
}

function isChordOnlyText(str) {
  if (!str) return true;
  const textWithoutChords = str.replace(/\[[^\]]*\]/g, '').trim();
  if (textWithoutChords === '') return true;
  const annotationRegex = /^[\(\[\{]?\s*(x\d+\vert{}\d+x\vert{}x\s*\d+\vert{}riff\vert{}repeat\vert{}x2\vert{}x4\vert{}outro\vert{}intro\vert{}solo\vert{}instrumental\vert{}\d+)\s*[\)\]\}]?$/i;
  return annotationRegex.test(textWithoutChords);
}

function processInlineChords(text) {
  if (!text) return "";
  
  if (!text.includes('[')) {
    return `<span class="lyric-text" style="white-space: normal; word-break: break-word;">${text}</span>`;
  }
  
  let processed = text.replace(/\[([A-G][b#]?[^\]]*)\](_+)/g, (match, chord, underscores) => {
    const spaces = '&nbsp;'.repeat(underscores.length);
    return `[${chord}]${spaces}`;
  });
  
  processed = processed.replace(/_/g, '');
  const parts = processed.split('[');
  let result = '<span class="chord-line-wrapper" style="display: inline-flex; flex-wrap: wrap; max-width: 100%; word-break: break-word;">';

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if (i === 0 && part === '') continue;

    if (i === 0 || !part.includes(']')) {
      result += `<span class="chord-segment" style="display: inline-flex; flex-direction: column; white-space: normal;"><span class="inline-chord empty"></span><span class="lyric-text">${part}</span></span>`;
    } else {
      const splitPart = part.split(']');
      const chord = splitPart[0];
      const lyricText = splitPart.slice(1).join(']');
      const currentChord = transposeChordName(chord, transposeSteps);

      const annotationMatch = lyricText.match(/^(\s*)([\(\[\{].*?[\)\]\}]|\bx\d+\b)(.*)$/i);
      
      if (annotationMatch && lyricText.trim().replace(/^[\(\[\{].*?[\)\]\}]/, '').trim() === '') {
        result += `<span class="chord-segment" style="display: inline-flex; flex-direction: column; white-space: normal;"><span class="inline-chord" data-original-chord="${chord}" onclick="showChordDiagram(this.textContent)">${currentChord}</span><span class="lyric-text">&nbsp;</span></span>`;
        result += `<span class="chord-annotation" style="white-space: normal;">${annotationMatch[1]}${annotationMatch[2]}${annotationMatch[3]}</span>`;
      } else {
        let textHtml = '';
        if (lyricText.length > 0) {
          let firstChar = lyricText.charAt(0);
          if (firstChar !== ' ' && !firstChar.startsWith('&')) {
            textHtml = `<span class="highlighted-syllable-marker">${firstChar}</span>${lyricText.slice(1)}`;
          } else {
            textHtml = lyricText;
          }
        } else {
          textHtml = '&nbsp;';
        }

        result += `<span class="chord-segment" style="display: inline-flex; flex-direction: column; white-space: normal;"><span class="inline-chord" data-original-chord="${chord}" onclick="showChordDiagram(this.textContent)">${currentChord}</span><span class="lyric-text">${textHtml}</span></span>`;
      }
    }
  }
  result += '</span>';
  return result;
}

function configurePillVisibility(elementId, isAvailable) {
  const checkbox = document.getElementById(elementId);
  if (!checkbox) return;
  const pill = checkbox.closest('.toggle-pill') || checkbox.parentElement;
  if (pill) {
    if (isAvailable) {
      pill.classList.remove('hidden');
      pill.style.display = '';
    } else {
      pill.classList.add('hidden');
      checkbox.checked = false;
    }
  }
}

function showChordDiagram(chord) {
  console.log('Chord clicked:', chord);
}

// 6. SONG DATA PARSER & DOM BUILDER
function buildLyrics() {
  let headerContainer = document.getElementById('headerContainer');
  let lyricsContainer = document.getElementById('lyricsContainer');
  
  if (!headerContainer) {
    headerContainer = document.createElement('div');
    headerContainer.id = 'headerContainer';
    document.body.insertBefore(headerContainer, document.body.firstChild);
  }
  
  if (!lyricsContainer) {
    lyricsContainer = document.createElement('div');
    lyricsContainer.id = 'lyricsContainer';
    document.body.appendChild(lyricsContainer);
  }

  if (typeof songData === 'undefined') return;

  lyricsContainer.innerHTML = '';
  
  // Remove previously generated dynamic title, artist, and key items without destroying toolbar controls
  const oldDynamicHeaders = headerContainer.querySelectorAll('.song-title, .song-artist, .member-key-container');
  oldDynamicHeaders.forEach(el => el.remove());

  let hasMember = false, hasChords = false, hasHangul = false, hasRoman = false, hasEnglish = false;
  let keyString = "";
  let currentMember = "";

  const blocks = songData.trim().split(/\n\s*\n/);

  blocks.forEach(blockStr => {
    const lines = blockStr.trim().split('\n');
    let title = "", artist = "";
    let section = "", member = "";
    let hangul = "", roman = "", english = "", chordOnly = "";

    lines.forEach(l => {
      const line = l.trim();
      if (line.startsWith('Title:')) title = line.replace('Title:', '').trim();
      else if (line.startsWith('Artist:')) artist = line.replace('Artist:', '').trim();
      else if (line.startsWith('Key:') || line.startsWith('K:')) keyString = line.replace(/^(Key:|K:)/, '').trim();
      else if (line.startsWith('S:')) section = line.replace('S:', '').trim();
      else if (line.startsWith('M:')) { member = line.replace('M:', '').trim(); }
      else if (line.startsWith('C:')) { chordOnly = line.replace('C:', '').trim(); hasChords = true; }
      else if (line.startsWith('H:')) { hangul = line.replace('H:', '').trim(); hasHangul = true; }
      else if (line.startsWith('R:')) { roman = line.replace('R:', '').trim(); hasRoman = true; }
      else if (line.startsWith('E:')) { english = line.replace('E:', '').trim(); hasEnglish = true; }
      else if (line && !line.includes(':')) {
        if (!hangul) hangul = line;
        else if (!roman) roman = line;
        else if (!english) english = line;
      }
    });

    if (title || artist) {
      if (title) {
        const h1 = document.createElement('h1');
        h1.className = 'song-title';
        h1.style.textAlign = 'center';
        h1.textContent = title;
        headerContainer.appendChild(h1);
      }
      if (artist) {
        const h2 = document.createElement('h2');
        h2.className = 'song-artist';
        h2.style.textAlign = 'center';
        h2.textContent = artist;
        headerContainer.appendChild(h2);
      }
      return;
    }

    if (section) {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'section-header';
      sectionDiv.textContent = section;
      lyricsContainer.appendChild(sectionDiv);
    }

    if (member) {
      currentMember = member;
    } else if (hangul || roman || english || chordOnly) {
      member = currentMember;
    }

    if (member) hasMember = true;
    if (hangul) hasHangul = true;
    if (roman) hasRoman = true;
    if (english) hasEnglish = true;

    const isChordOnlyBlock = Boolean(chordOnly) || (
      (hangul || roman || english) &&
      isChordOnlyText(hangul) &&
      isChordOnlyText(roman) &&
      isChordOnlyText(english)
    );

    if (member || hangul || roman || english || chordOnly) {
      const blockDiv = document.createElement('div');
      blockDiv.className = 'line-block';
      if (member) blockDiv.setAttribute('data-member', member);
      if (isChordOnlyBlock) blockDiv.setAttribute('data-chord-only', 'true');

      if (hangul.includes('[') || roman.includes('[') || english.includes('[') || chordOnly.includes('[')) {
        hasChords = true;
      }

      blockDiv.innerHTML = `
        <div class="member-col"></div>
        <div class="content-col" style="max-width: 100%; overflow-wrap: break-word; word-break: break-word;">
          ${chordOnly ? `<div class="lyric-line chord-only-line">${processInlineChords(chordOnly)}</div>` : ''}
          ${hangul ? `<div class="lyric-line hangul">${processInlineChords(hangul)}</div>` : ''}
          ${roman ? `<div class="lyric-line romanized">${processInlineChords(roman)}</div>` : ''}
          ${english ? `<div class="lyric-line english">${processInlineChords(english)}</div>` : ''}
        </div>
      `;

      lyricsContainer.appendChild(blockDiv);
    }
  });

  if (keyString) {
    const keyContainer = document.createElement('div');
    keyContainer.className = 'member-key-container';
    keyContainer.id = 'memberKeyContainer';

    const items = keyString.split(/[\|,;]/);
    items.forEach(item => {
      const trimmed = item.trim();
      if (!trimmed) return;

      const parts = trimmed.split('=');
      let emoji = "", name = "";
      if (parts.length === 2) {
        emoji = parts[0].trim();
        name = parts[1].trim();
      } else {
        const firstSpaceIndex = trimmed.search(/\s/);
        if (firstSpaceIndex !== -1) {
          emoji = trimmed.substring(0, firstSpaceIndex).trim();
          name = trimmed.substring(firstSpaceIndex).trim();
        } else {
          emoji = trimmed;
        }
      }

      const keyItem = document.createElement('span');
      keyItem.className = 'member-key-item';
      keyItem.setAttribute('data-emoji', emoji);
      keyItem.onclick = function() { toggleMemberFilter(emoji); };
      keyItem.innerHTML = `<span class="member-key-emoji">${emoji}</span> ${name}`;
      keyContainer.appendChild(keyItem);
    });

    headerContainer.appendChild(keyContainer);
  }

  configurePillVisibility('showMember', hasMember || true);
  configurePillVisibility('showChords', hasChords || true);
  configurePillVisibility('showHangul', hasHangul || true);
  configurePillVisibility('showRoman', hasRoman || true);
  configurePillVisibility('showEnglish', hasEnglish || true);
}

// 7. MEMBER FILTERING CONTROLLER
function toggleMemberFilter(emoji) {
  const items = document.querySelectorAll('.member-key-item');
  if (activeMemberFilter === emoji) {
    activeMemberFilter = null;
    items.forEach(item => item.classList.remove('active'));
  } else {
    activeMemberFilter = emoji;
    items.forEach(item => {
      if (item.getAttribute('data-emoji') === emoji) item.classList.add('active');
      else item.classList.remove('active');
    });
  }
  applyMemberFilter();
}

function applyMemberFilter() {
  const blocks = document.querySelectorAll('.line-block');
  blocks.forEach(block => {
    const member = block.getAttribute('data-member');
    if (!activeMemberFilter || member === activeMemberFilter) {
      block.style.opacity = '1';
    } else {
      block.style.opacity = '0.35';
    }
  });
}

function updateMemberColumn(showMember) {
  const blocks = document.querySelectorAll('.line-block');
  blocks.forEach(block => {
    const col = block.querySelector('.member-col');
    if (!col) return;
    if (showMember) {
      col.style.display = 'block';
      const member = block.getAttribute('data-member') || '';
      col.innerHTML = member ? `<span class="member-prefix">${member}:</span>` : '';
    } else {
      col.style.display = 'none';
      col.innerHTML = '';
    }
  });
}

// 8. VIEW & TOGGLE CONTROLLER
function updateView() {
  const showMemberEl = document.getElementById('showMember');
  const showChordsEl = document.getElementById('showChords');
  const showHangulEl = document.getElementById('showHangul');
  const showRomanEl = document.getElementById('showRoman');
  const showEnglishEl = document.getElementById('showEnglish');

  const memberOn = showMemberEl ? showMemberEl.checked : true;
  const chordsOn = showChordsEl ? showChordsEl.checked : true;
  const hangulOn = showHangulEl ? showHangulEl.checked : true;
  const romanOn = showRomanEl ? showRomanEl.checked : true;
  const englishOn = showEnglishEl ? showEnglishEl.checked : true;

  const keyContainer = document.getElementById('memberKeyContainer');
  if (keyContainer) {
    if (memberOn) keyContainer.classList.remove('hidden');
    else {
      keyContainer.classList.add('hidden');
      if (activeMemberFilter) toggleMemberFilter(activeMemberFilter);
    }
  }

  const transWidget = document.getElementById('transposeWidget');
  if (transWidget) {
    const chordPill = showChordsEl ? (showChordsEl.closest('.toggle-pill') || showChordsEl.parentElement) : null;
    if (chordsOn && (!chordPill || !chordPill.classList.contains('hidden'))) {
      transWidget.classList.remove('hidden');
    } else {
      transWidget.classList.add('hidden');
    }
  }

  const blocks = document.querySelectorAll('.line-block');
  blocks.forEach(block => {
    const isChordOnly = block.getAttribute('data-chord-only') === 'true';

    if (isChordOnly && !chordsOn) {
      block.classList.add('hidden');
      return;
    } else if (isChordOnly && chordsOn) {
      block.classList.remove('hidden');
    }

    const hangulEl = block.querySelector('.hangul');
    const romanEl = block.querySelector('.romanized');
    const englishEl = block.querySelector('.english');
    const chordOnlyEl = block.querySelector('.chord-only-line');

    if (hangulEl) hangulEl.classList.remove('hidden');
    if (romanEl) romanEl.classList.remove('hidden');
    if (englishEl) englishEl.classList.remove('hidden');
    if (chordOnlyEl) chordOnlyEl.classList.remove('hidden');

    if (hangulEl && !hangulOn) hangulEl.classList.add('hidden');
    if (romanEl && !romanOn) romanEl.classList.add('hidden');
    if (englishEl && !englishOn) englishEl.classList.add('hidden');

    let dynamicSeenTexts = new Set();
    const checkVisibilityPriority = (el, toggleActive) => {
      if (!el || el.classList.contains('hidden')) return;
      if (toggleActive) {
        const rawCleanText = stripChordTags(el.innerHTML).trim();
        if (dynamicSeenTexts.has(rawCleanText) && rawCleanText !== "") {
          el.classList.add('hidden');
        } else {
          dynamicSeenTexts.add(rawCleanText);
        }
      }
    };
    checkVisibilityPriority(hangulEl, hangulOn);
    checkVisibilityPriority(romanEl, romanOn);
    checkVisibilityPriority(englishEl, englishOn);

    let chordRowAssigned = false;
    const targetLines = [hangulEl, romanEl, englishEl, chordOnlyEl];

    targetLines.forEach(el => {
      if (!el || el.classList.contains('hidden')) return;

      const inlineChords = el.querySelectorAll('.inline-chord');
      const highlightedSyllables = el.querySelectorAll('.highlighted-syllable-marker');

      highlightedSyllables.forEach(s => {
        if (chordsOn) s.className = 'highlighted-syllable';
        else s.className = '';
      });

      if (chordsOn && !chordRowAssigned && inlineChords.length > 0) {
        inlineChords.forEach(c => c.classList.remove('hidden'));
        chordRowAssigned = true;
      } else {
        inlineChords.forEach(c => c.classList.add('hidden'));
      }
    });

    const visibleLines = block.querySelectorAll('.lyric-line:not(.hidden)');
    if (visibleLines.length === 0) {
      block.classList.add('hidden');
    } else {
      block.classList.remove('hidden');
    }
  });

  const container = document.getElementById('lyricsContainer');
  if (container) {
    const children = Array.from(container.children);
    let currentHeader = null;
    let hasVisibleBlocks = false;

    children.forEach(child => {
      if (child.classList.contains('section-header')) {
        if (currentHeader) {
          if (hasVisibleBlocks) currentHeader.classList.remove('hidden');
          else currentHeader.classList.add('hidden');
        }
        currentHeader = child;
        hasVisibleBlocks = false;
      } else if (child.classList.contains('line-block')) {
        if (!child.classList.contains('hidden')) {
          hasVisibleBlocks = true;
        }
      }
    });

    if (currentHeader) {
      if (hasVisibleBlocks) currentHeader.classList.remove('hidden');
      else currentHeader.classList.add('hidden');
    }
  }

  updateMemberColumn(memberOn);
  applyMemberFilter();
}
