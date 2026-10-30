/* Classroom Tools · Conference Sign-Up
   Compatibility layer for cached versions of the public appointment renderer.
   Ensures each appointment card carries its OWN conference date, even if the
   older time-only markup has been served by a browser or CDN cache.
   Does not modify Firebase records, appointment selection, or booking actions. */
(() => {
  'use strict';
  const container = document.getElementById('eventPublicSlots');
  if (!container) return;

  // Isolated styling ensures cards remain readable even with a stale stylesheet.
  if (!document.getElementById('glnConferenceSlotDateGuardStyle')) {
    const style = document.createElement('style');
    style.id = 'glnConferenceSlotDateGuardStyle';
    style.textContent = `
      #eventPublicSlots .event-public-slot {
        grid-template-columns: minmax(220px, 1.15fr) minmax(140px, 1fr) auto;
        gap: 12px;
        align-items: center;
      }
      #eventPublicSlots .event-public-slot-datetime {
        display:flex; flex-direction:column; gap:5px; min-width:0;
      }
      #eventPublicSlots .event-public-slot-date {
        display:block; font-size:.92rem; line-height:1.35;
        font-weight:850; color:#173868; overflow-wrap:break-word;
      }
      #eventPublicSlots .event-public-slot-time {
        display:block; font-size:.94rem; line-height:1.3;
        font-weight:850; color:#176b9c;
      }
      body.theme-rgb #eventPublicSlots .event-public-slot-date,
      body.rgb-theme #eventPublicSlots .event-public-slot-date {
        color:#f4f8ff !important;
      }
      body.theme-rgb #eventPublicSlots .event-public-slot-time,
      body.rgb-theme #eventPublicSlots .event-public-slot-time {
        color:#9fdcff !important;
      }
      @media (max-width:920px) {
        #eventPublicSlots .event-public-slot {
          grid-template-columns: minmax(180px,1fr) minmax(130px,1fr) auto;
        }
      }
      @media (max-width:670px) {
        #eventPublicSlots .event-public-slot {grid-template-columns:1fr;gap:10px;}
        #eventPublicSlots .event-public-slot button {width:100%;}
      }
    `;
    document.head.append(style);
  }

  // Expand the abbreviated date on legacy day headings for clearer parent display.
  const weekdays = {Sun:'Sunday',Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday'};
  const months = {Jan:'January',Feb:'February',Mar:'March',Apr:'April',May:'May',Jun:'June',Jul:'July',Aug:'August',Sep:'September',Oct:'October',Nov:'November',Dec:'December'};
  function fullLabel(label) {
    return String(label || '').trim()
      .replace(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/, match => weekdays[match])
      .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/, match => months[match]);
  }

  function ensureDatesOnEverySlot() {
    let groupDate = '';
    for (const element of container.children) {
      if (element.classList.contains('event-public-day-heading')) {
        groupDate = fullLabel(element.querySelector('strong')?.textContent);
        continue;
      }
      if (!element.classList.contains('event-public-slot')) continue;
      const existingDate = element.querySelector('.event-public-slot-date');
      if (existingDate) {
        // New renderer already placed the date in the card; do not duplicate it.
        continue;
      }
      if (!groupDate) continue;
      const first = element.firstElementChild;
      if (!first) continue;
      const dateTime = document.createElement('div');
      dateTime.className = 'event-public-slot-datetime';
      const day = document.createElement('strong');
      day.className = 'event-public-slot-date';
      day.textContent = groupDate;
      dateTime.append(day);
      if (first.tagName === 'STRONG') {
        // Legacy version: the first cell contained only the start time.
        const time = document.createElement('span');
        time.className = 'event-public-slot-time';
        time.textContent = first.textContent;
        dateTime.append(time);
        first.replaceWith(dateTime);
      } else {
        // Nonstandard layout: keep existing booking content and prepend the date.
        element.prepend(dateTime);
      }
    }
  }

  // The Firebase sign-up renderer rebuilds the cards when availability changes.
  // Observe only DIRECT children to avoid an observer loop from our own inserts.
  const observer = new MutationObserver(ensureDatesOnEverySlot);
  observer.observe(container, {childList:true});
  ensureDatesOnEverySlot();
})();
