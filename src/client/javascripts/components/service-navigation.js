/**
 * Progressive enhancement for `.defra-service-navigation`'s mobile toggle.
 *
 * The toggle button starts `hidden` in the markup so it never appears
 * without this script - without JS, the link list is always shown in full
 * (its mobile CSS only reflows it to a column, it never collapses it).
 */
function initServiceNavigation () {
  const toggles = document.querySelectorAll('.js-service-navigation-toggle')

  toggles.forEach((toggle) => {
    toggle.hidden = false

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true'
      const list = document.getElementById(toggle.getAttribute('aria-controls'))

      toggle.setAttribute('aria-expanded', String(!expanded))
      list?.classList.toggle('defra-service-navigation__list--open', !expanded)
    })
  })
}

export {
  initServiceNavigation
}
