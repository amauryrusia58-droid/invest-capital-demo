const card = document.querySelector('#presentacion');
const play = card.querySelector('button');
const player = card.querySelector('video');
const simulator = card.nextElementSibling;
const actions = document.querySelector('#startBtn').parentElement;
const mobile = matchMedia('(max-width:1023px)');
function placeCard() {
  if (mobile.matches) actions.after(card);
  else simulator.before(card);
}
placeCard();
mobile.addEventListener('change', placeCard);
play.addEventListener('click', async () => {
  player.src = mobile.matches ? 'video/vertical.mp4' : 'video/horizontal.mp4';
  player.hidden = false;
  play.hidden = true;
  try {
    await player.play();
    player.focus({preventScroll:true});
  } catch {
    player.hidden = true;
    play.hidden = false;
    card.querySelector('[role=status]').textContent = 'No se pudo reproducir el video. Vuelve a intentarlo.';
  }
});
