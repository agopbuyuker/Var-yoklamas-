(function () {
  function resultsHTML(positionId, counts) {
    return (
      '<div class="results" data-position-id="' + positionId + '">' +
      '<div class="result-row"><span class="result-label">Doğru</span>' +
      '<div class="bar-track"><div class="bar-fill bar-dogru" style="width:' + counts.dogruPct + '%"></div></div>' +
      '<span class="result-pct">' + counts.dogruPct + '%</span></div>' +
      '<div class="result-row"><span class="result-label">Yanlış</span>' +
      '<div class="bar-track"><div class="bar-fill bar-yanlis" style="width:' + counts.yanlisPct + '%"></div></div>' +
      '<span class="result-pct">' + counts.yanlisPct + '%</span></div>' +
      '<p class="total-votes">' + counts.total + ' oy</p>' +
      '</div>'
    );
  }

  document.querySelectorAll('.vote-form').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const buttons = form.querySelectorAll('.vote-btn');
      buttons.forEach((b) => (b.disabled = true));

      const submitter = e.submitter;
      const choice = submitter ? submitter.value : form.querySelector('input[name="choice"]')?.value;
      const positionId = form.getAttribute('data-position-id');

      try {
        const res = await fetch('/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'position_id=' + encodeURIComponent(positionId) + '&choice=' + encodeURIComponent(choice),
        });
        const data = await res.json();
        const card = form.closest('.position-card');
        if (!res.ok) {
          alert(data.message || 'Bir hata oluştu, tekrar dene.');
          buttons.forEach((b) => (b.disabled = false));
          return;
        }
        const voteArea = card.querySelector('.vote-area');
        const notice = document.createElement('p');
        notice.className = 'voted-note';
        notice.innerHTML = 'Oyun kaydedildi: <strong>' + (choice === 'dogru' ? 'Doğru' : 'Yanlış') + '</strong>';
        const existingResults = voteArea.querySelector('.results');
        if (existingResults) existingResults.remove();
        form.remove();
        const hint = voteArea.querySelector('.vote-empty-hint');
        if (hint) hint.remove();
        voteArea.prepend(notice);
        voteArea.insertAdjacentHTML('beforeend', resultsHTML(positionId, data.counts));
      } catch (err) {
        alert('Bağlantı hatası, tekrar dene.');
        buttons.forEach((b) => (b.disabled = false));
      }
    });
  });
})();
