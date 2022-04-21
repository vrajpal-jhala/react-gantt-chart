import DateUtils from '../utils/date';
import SVGUtils, { createSVG, animateSVG } from '../utils/svg';

export default class Bar {
  constructor(gantt, task) {
    this.setDefaults(gantt, task);
    this.prepare();
    this.draw();
    this.bind();
  }

  setDefaults(gantt, task) {
    this.actionCompleted = false;
    this.gantt = gantt;
    this.task = task;
  }

  prepare = () => {
    this.prepareValues();
    this.prepareHelpers();
  };

  prepareValues = () => {
    this.invalid = this.task.invalid;
    this.height = this.gantt.options.barHeight;
    this.x = this.computeX();
    this.y = this.computeY();
    this.cornerRadius = this.gantt.options.barCornerRadius;
    this.duration = DateUtils.diff(this.task.end, this.task.start, 'hour')
      / this.gantt.options.step;
    this.width = this.gantt.options.columnWidth * this.duration;
    this.progressWidth = this.gantt.options.columnWidth
        * this.duration
        * (this.task.progress / 100) || 0;
    this.group = createSVG('g', {
      class: `bar-wrapper ${this.task.customClass || ''}`,
      'data-id': this.task.id,
    });
    this.barGroup = createSVG('g', {
      class: 'bar-group',
      appendTo: this.group,
    });
    this.handleGroup = createSVG('g', {
      class: 'handle-group',
      appendTo: this.group,
    });
  };

  prepareHelpers = () => {
    SVGElement.prototype.getX = () => +this.getAttribute('x');
    SVGElement.prototype.getY = () => +this.getAttribute('y');
    SVGElement.prototype.getWidth = () => +this.getAttribute('width');
    SVGElement.prototype.getHeight = () => +this.getAttribute('height');
    SVGElement.prototype.getEndX = () => this.getX() + this.getWidth();
  };

  draw = () => {
    this.drawBar();
    this.drawProgressBar();
    this.drawLabel();
    this.drawResizeHandles();
  };

  drawBar = () => {
    this.$bar = createSVG('rect', {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rx: this.cornerRadius,
      ry: this.cornerRadius,
      class: 'bar',
      appendTo: this.barGroup,
    });

    animateSVG(this.$bar, 'width', 0, this.width);

    if (this.invalid) {
      this.$bar.classList.add('bar-invalid');
    }
  };

  drawProgressBar = () => {
    if (this.invalid) return;
    this.$barProgress = createSVG('rect', {
      x: this.x,
      y: this.y,
      width: this.progressWidth,
      height: this.height,
      rx: this.cornerRadius,
      ry: this.cornerRadius,
      class: 'bar-progress',
      appendTo: this.barGroup,
    });

    animateSVG(this.$barProgress, 'width', 0, this.progressWidth);
  };

  drawLabel = () => {
    createSVG('text', {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
      innerHTML: this.task.name,
      class: 'bar-label',
      appendTo: this.barGroup,
    });
    // labels get BBox in the next tick
    requestAnimationFrame(() => this.updateLabelPosition());
  };

  drawResizeHandles = () => {
    if (this.invalid) return;

    const bar = this.$bar;
    const handleWidth = 8;

    createSVG('rect', {
      x: bar.getX() + bar.getWidth() - 9,
      y: bar.getY() + 1,
      width: handleWidth,
      height: this.height - 2,
      rx: this.cornerRadius,
      ry: this.cornerRadius,
      class: 'handle right',
      appendTo: this.handleGroup,
    });

    createSVG('rect', {
      x: bar.getX() + 1,
      y: bar.getY() + 1,
      width: handleWidth,
      height: this.height - 2,
      rx: this.cornerRadius,
      ry: this.cornerRadius,
      class: 'handle left',
      appendTo: this.handleGroup,
    });

    if (this.task.progress && this.task.progress < 100) {
      this.$handleProgress = createSVG('polygon', {
        points: this.getProgressPolygonPoints().join(','),
        class: 'handle progress',
        appendTo: this.handleGroup,
      });
    }
  };

  getProgressPolygonPoints = () => {
    const barProgress = this.$barProgress;
    return [
      barProgress.getEndX() - 5,
      barProgress.getY() + barProgress.getHeight(),
      barProgress.getEndX() + 5,
      barProgress.getY() + barProgress.getHeight(),
      barProgress.getEndX(),
      barProgress.getY() + barProgress.getHeight() - 8.66,
    ];
  };

  bind = () => {
    if (this.invalid) return;
    this.setupClickEvent();
  };

  setupClickEvent = () => {
    SVGUtils.on(this.group, `focus ${this.gantt.options.popupTrigger}`, () => {
      if (this.actionCompleted) {
        // just finished a move action, wait for a few seconds
        return;
      }

      this.showPopup();
      this.gantt.unselectAll();
      this.group.classList.add('active');
    });

    SVGUtils.on(this.group, 'dblclick', () => {
      if (this.actionCompleted) {
        // just finished a move action, wait for a few seconds
        return;
      }

      this.gantt.triggerEvent('click', [this.task]);
    });
  };

  showPopup = () => {
    if (this.gantt.barBeingDragged) return;

    const startDate = DateUtils.format(
      this.task.start,
      'MMM D',
      this.gantt.options.language,
    );
    const endDate = DateUtils.format(
      DateUtils.add(this.task.end, -1, 'second'),
      'MMM D',
      this.gantt.options.language,
    );
    const subtitle = `${startDate} - ${endDate}`;

    this.gantt.showPopup({
      targetElement: this.$bar,
      title: this.task.name,
      subtitle,
      task: this.task,
    });
  };

  updateBarPosition = ({ x = null, width = null }) => {
    const bar = this.$bar;
    if (x) {
      // get all x values of parent task
      const xs = this.task.dependencies.map((dep) => this.gantt.getBar(dep).$bar.getX());
      // child task must not go before parent
      const validX = xs.reduce((prev, curr) => x >= curr, x);
      if (!validX) {
        width = null;
        return;
      }
      this.updateAttr(bar, 'x', x);
    }
    if (width && width >= this.gantt.options.columnWidth) {
      this.updateAttr(bar, 'width', width);
    }
    this.updateLabelPosition();
    this.updateHandlePosition();
    this.updateProgressbarPosition();
    this.updateArrowPosition();
  };

  dateChanged = () => {
    let changed = false;
    const { newStartDate, newEndDate } = this.computeStartEndDate();

    if (Number(this.task.start) !== Number(newStartDate)) {
      changed = true;
      this.task.start = newStartDate;
    }

    if (Number(this.task.end) !== Number(newEndDate)) {
      changed = true;
      this.task.end = newEndDate;
    }

    if (!changed) return;

    this.gantt.triggerEvent('dateChange', [
      this.task,
      newStartDate,
      DateUtils.add(newEndDate, -1, 'second'),
    ]);
  };

  progressChanged = () => {
    const newProgress = this.computeProgress();
    this.task.progress = newProgress;
    this.gantt.triggerEvent('progressChange', [this.task, newProgress]);
  };

  setActionCompleted = () => {
    this.actionCompleted = true;
    setTimeout(() => { this.actionCompleted = false; }, 1000);
  };

  computeStartEndDate = () => {
    const bar = this.$bar;
    const xInUnits = bar.getX() / this.gantt.options.columnWidth;
    const newStartDate = DateUtils.add(
      this.gantt.ganttStart,
      xInUnits * this.gantt.options.step,
      'hour',
    );
    const widthInUnits = bar.getWidth() / this.gantt.options.columnWidth;
    const newEndDate = DateUtils.add(
      newStartDate,
      widthInUnits * this.gantt.options.step,
      'hour',
    );

    return { newStartDate, newEndDate };
  };

  computeProgress = () => {
    const progress = (this.$barProgress.getWidth() / this.$bar.getWidth()) * 100;
    return parseInt(progress, 10);
  };

  computeX = () => {
    const { step, columnWidth } = this.gantt.options;
    const taskStart = this.task.start;
    const { ganttStart } = this.gantt;

    const hourDiff = DateUtils.diff(taskStart, ganttStart, 'hour');
    let x = (hourDiff / step) * columnWidth;

    if (this.gantt.viewIs('Month')) {
      const dayDiff = DateUtils.diff(taskStart, ganttStart, 'day');
      x = (dayDiff * columnWidth) / 30;
    }
    return x;
  };

  computeY = () => (
    this.gantt.options.headerHeight
      + this.gantt.options.padding
      + this.task.index * (this.height + this.gantt.options.padding)
  );

  getSnapPosition = (dx) => {
    const odx = dx;
    let rem;
    let position;

    if (this.gantt.viewIs('Week')) {
      rem = dx % (this.gantt.options.columnWidth / 7);
      position = odx
        - rem
        + (rem < this.gantt.options.columnWidth / 14
          ? 0
          : this.gantt.options.columnWidth / 7);
    } else if (this.gantt.viewIs('Month')) {
      rem = dx % (this.gantt.options.columnWidth / 30);
      position = odx
        - rem
        + (rem < this.gantt.options.columnWidth / 60
          ? 0
          : this.gantt.options.columnWidth / 30);
    } else {
      rem = dx % this.gantt.options.columnWidth;
      position = odx
        - rem
        + (rem < this.gantt.options.columnWidth / 2
          ? 0
          : this.gantt.options.columnWidth);
    }
    return position;
  };

  static updateAttr = (element, attr, value) => {
    value = +value;
    if (!Number.isNaN(value)) {
      element.setAttribute(attr, value);
    }
    return element;
  };

  updateProgressbarPosition = () => {
    this.$barProgress.setAttribute('x', this.$bar.getX());
    this.$barProgress.setAttribute(
      'width',
      this.$bar.getWidth() * (this.task.progress / 100),
    );
  };

  updateLabelPosition = () => {
    const bar = this.$bar;
    const label = this.group.querySelector('.bar-label');

    if (label.getBBox().width > bar.getWidth()) {
      label.classList.add('big');
      label.setAttribute('x', bar.getX() + bar.getWidth() + 5);
    } else {
      label.classList.remove('big');
      label.setAttribute('x', bar.getX() + bar.getWidth() / 2);
    }
  };

  updateHandlePosition = () => {
    const bar = this.$bar;
    this.handleGroup
      .querySelector('.handle.left')
      .setAttribute('x', bar.getX() + 1);
    this.handleGroup
      .querySelector('.handle.right')
      .setAttribute('x', bar.getEndX() - 9);
    const handle = this.group.querySelector('.handle.progress');
    if (handle) handle.setAttribute('points', this.getProgressPolygonPoints());
  };

  updateArrowPosition = () => {
    this.arrows = this.arrows || [];
    this.arrows.forEach((arrow) => {
      arrow.update();
    });
  };
}
