function applyMemberFilter() {
  const blocks = Array.from(document.querySelectorAll('.line-block'));

  // Step 1: Mark matching state on dataset attributes
  blocks.forEach(block => {
    const memberAttr = block.getAttribute('data-member') || "";
    let isMatch = false;
    if (activeMemberFilter) {
      const isAll = memberAttr.toUpperCase().includes("ALL");
      isMatch = memberAttr.includes(activeMemberFilter) || isAll;
    }
    block.dataset.isMatch = isMatch ? "true" : "false";
  });

  // Step 2: Check immediate DOM siblings to apply border & radius classes
  blocks.forEach(block => {
    block.classList.remove(
      'member-highlighted',
      'member-dimmed',
      'highlight-start',
      'highlight-middle',
      'highlight-end',
      'highlight-only'
    );

    if (activeMemberFilter) {
      const isMatch = block.dataset.isMatch === "true";

      if (isMatch) {
        block.classList.add('member-highlighted');

        const prevSib = block.previousElementSibling;
        const nextSib = block.nextElementSibling;

        const prevMatch = prevSib && prevSib.classList.contains('line-block') && prevSib.dataset.isMatch === "true";
        const nextMatch = nextSib && nextSib.classList.contains('line-block') && nextSib.dataset.isMatch === "true";

        if (!prevMatch && nextMatch) {
          block.classList.add('highlight-start');
        } else if (prevMatch && nextMatch) {
          block.classList.add('highlight-middle');
        } else if (prevMatch && !nextMatch) {
          block.classList.add('highlight-end');
        } else {
          block.classList.add('highlight-only');
        }
      } else {
        block.classList.add('member-dimmed');
      }
    }
  });
}
