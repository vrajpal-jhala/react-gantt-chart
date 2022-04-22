export default class Popup {
  constructor(parent, customHtml) {
    this.parent = parent;
    this.customHtml = customHtml;
    this.make();
  }

  make() {
    this.parent.innerHTML = `
      <div class="title"></div>
      <div class="subtitle"></div>
      <div class="pointer"></div>`;

    this.hide();

    this.title = this.parent.querySelector('.title');
    this.subtitle = this.parent.querySelector('.subtitle');
    this.pointer = this.parent.querySelector('.pointer');
  }

  show(options) {
    if (!options.targetElement) {
      throw new Error('targetElement is required to show popup');
    }
    if (!options.position) {
      options.position = 'left';
    }
    const { targetElement } = options;

    if (this.customHtml) {
      let html = this.customHtml(options.task);
      html += '<div class="pointer"></div>';
      this.parent.innerHTML = html;
      this.pointer = this.parent.querySelector('.pointer');
    } else {
      // set data
      this.title.innerHTML = options.title;
      this.subtitle.innerHTML = options.subtitle;
      this.parent.style.width = `${this.parent.clientWidth}px`;
    }

    // set position
    let positionMeta;
    if (targetElement instanceof HTMLElement) {
      positionMeta = targetElement.getBoundingClientRect();
    } else if (targetElement instanceof SVGElement) {
      positionMeta = options.targetElement.getBBox();
    }

    if (options.position === 'left') {
      this.parent.style.left = `${positionMeta.x + (positionMeta.width + 10)}px`;
      this.parent.style.top = `${positionMeta.y}px`;

      this.pointer.style.transform = 'rotateZ(90deg)';
      this.pointer.style.left = '-7px';
      this.pointer.style.top = '2px';
    }

    // show
    this.parent.style.opacity = 1;
  }

  hide() {
    this.parent.style.opacity = 0;
    this.parent.style.left = 0;
  }
}
