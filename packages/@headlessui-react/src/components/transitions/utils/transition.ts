import { once } from '../../../utils/once'
import { disposables } from '../../../utils/disposables'
import { match } from '../../../utils/match'

function addClasses(node: HTMLElement, ...classes: string[]) {
  node && classes.length > 0 && node.classList.add(...classes)
}

function removeClasses(node: HTMLElement, ...classes: string[]) {
  node && classes.length > 0 && node.classList.remove(...classes)
}

function waitForTransition(node: HTMLElement, done: () => void) {
  let d = disposables()

  if (!node) return d.dispose

  // Safari returns a comma separated list of values, so let's sort them and take the highest value.
  let { transitionDuration, transitionDelay } = getComputedStyle(node)

  let [durationMs, delayMs] = [transitionDuration, transitionDelay].map((value) => {
    let [resolvedValue = 0] = value
      .split(',')
      // Remove falsy we can't work with
      .filter(Boolean)
      // Values are returned as `0.3s` or `75ms`
      .map((v) => (v.includes('ms') ? parseFloat(v) : parseFloat(v) * 1000))
      .sort((a, z) => z - a)

    return resolvedValue
  })

  let totalDuration = durationMs + delayMs

  if (totalDuration !== 0) {
    if (process.env.NODE_ENV === 'test') {
      let dispose = d.setTimeout(() => {
        done()
        dispose()
      }, totalDuration)
    } else {
      let dispose = d.addEventListener(node, 'transitionend', (event) => {
        if (event.target !== event.currentTarget) return
        done()
        dispose()
      })
    }
  } else {
    // No transition is happening, so we should cleanup already. Otherwise we have to wait until we
    // get disposed.
    done()
  }

  // If we get disposed before the transition finishes, we should cleanup anyway.
  d.add(() => done())

  return d.dispose
}

export function transition(
  node: HTMLElement,
  classes: {
    enter: string[]
    enterFrom: string[]
    enterTo: string[]
    leave: string[]
    leaveFrom: string[]
    leaveTo: string[]
    entered: string[]
  },
  show: boolean,
  done?: () => void
) {
  let direction = show ? 'enter' : 'leave'
  let d = disposables()
  let _done = done !== undefined ? once(done) : () => {}

  // When using unmount={false}, when the element is "hidden", then we apply a `style.display =
  // 'none'` and a `hidden` attribute. Let's remove that in case we want to make an enter
  // transition. It can happen that React is removing this a bit too late causing the element to not
  // transition at all.
  if (direction === 'enter') {
    node.removeAttribute('hidden')
    node.style.display = ''
  }

  let base = match(direction, {
    enter: () => classes.enter,
    leave: () => classes.leave,
  })
  let to = match(direction, {
    enter: () => classes.enterTo,
    leave: () => classes.leaveTo,
  })
  let from = match(direction, {
    enter: () => classes.enterFrom,
    leave: () => classes.leaveFrom,
  })

  removeClasses(
    node,
    ...classes.enter,
    ...classes.enterTo,
    ...classes.enterFrom,
    ...classes.leave,
    ...classes.leaveFrom,
    ...classes.leaveTo,
    ...classes.entered
  )
  addClasses(node, ...base, ...from)

  d.nextFrame(() => {
    removeClasses(node, ...from)
    addClasses(node, ...to)

    waitForTransition(node, () => {
      removeClasses(node, ...base)
      addClasses(node, ...classes.entered)

      return _done()
    })
  })

  return d.dispose
}
