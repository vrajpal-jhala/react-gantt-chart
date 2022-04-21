export const createSVG = (tag, attrs) => {
  const elem = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.keys(attrs).forEach((attr) => {
    if (attr === 'appendTo') {
      const parent = attrs.appendTo;
      parent.appendChild(elem);
    } else if (attr === 'innerHTML') {
      elem.innerHTML = attrs.innerHTML;
    } else {
      elem.setAttribute(attr, attrs[attr]);
    }
  });

  return elem;
};

const cubicBezier = (name) => ({
  ease: '.25 .1 .25 1',
  linear: '0 0 1 1',
  'ease-in': '.42 0 1 1',
  'ease-out': '0 0 .58 1',
  'ease-in-out': '.42 0 .58 1',
}[name]);

const getAnimationElement = (
  svgElement,
  attr,
  from,
  to,
  dur = '0.4s',
  begin = '0.1s',
) => {
  const animEl = svgElement.querySelector('animate');
  if (animEl) {
    attr(animEl, {
      attributeName: attr,
      from,
      to,
      dur,
      begin: `click + ${begin}`, // artificial click
    });
    return svgElement;
  }

  const animateElement = createSVG('animate', {
    attributeName: attr,
    from,
    to,
    dur,
    begin,
    calcMode: 'spline',
    values: `${from};${to}`,
    keyTimes: '0; 1',
    keySplines: cubicBezier('ease-out'),
  });
  svgElement.appendChild(animateElement);

  return svgElement;
};

export const animateSVG = (svgElement, attr, from, to) => {
  const animatedSvgElement = getAnimationElement(svgElement, attr, from, to);

  if (animatedSvgElement === svgElement) {
    // triggered 2nd time programmatically
    // trigger artificial click event
    const event = new Event('click', { bubbles: true, cancelable: true });
    animatedSvgElement.dispatchEvent(event);
  }
};

const bind = (element, event, callback) => {
  event.split(/\s+/).forEach((e) => {
    element.addEventListener(e, callback);
  });
};

const delegate = (element, event, selector, callback) => {
  element.addEventListener(event, (e) => {
    const delegatedTarget = e.target.closest(selector);
    if (delegatedTarget) {
      e.delegatedTarget = delegatedTarget;
      callback.call(this, e, delegatedTarget);
    }
  });
};

const on = (element, event, selector, callback) => {
  if (!callback) {
    callback = selector;
    bind(element, event, callback);
  } else {
    delegate(element, event, selector, callback);
  }
};

const off = (element, event, handler) => {
  element.removeEventListener(event, handler);
};

const closest = (selector, element) => {
  if (!element) return null;

  if (element.matches(selector)) {
    return element;
  }

  return closest(selector, element.parentNode);
};

const attr = (element, attribute, value) => {
  if (!value && typeof attribute === 'string') {
    return element.getAttribute(attribute);
  }

  if (typeof attribute === 'object') {
    Object.keys(attribute).forEach((key) => {
      attr(element, key, attribute[key]);
    });

    return null;
  }

  element.setAttribute(attribute, value);
  return null;
};

export default {
  on,
  off,
  bind,
  delegate,
  closest,
  attr,
};
