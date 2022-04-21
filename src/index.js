// Import Components
import Bar from './components/bar';
import Arrow from './components/arrow';
import Popup from './components/popup';

// Import Miscs
import DateUtils from './utils/date';
import SVGUtils, { createSVG } from './utils/svg';
import './styles/gantt.scss';

const VIEW_MODE = {
  HOUR: 'Hour',
  QUARTERDAY: 'Quarter Day',
  HALFDAY: 'Half Day',
  DAY: 'Day',
  WEEK: 'Week',
  MONTH: 'Month',
  YEAR: 'Year',
};

function generateId(task) {
  return (
    `${task.name
    }${
      Math.random()
        .toString(36)
        .slice(2, 12)}`
  );
}

export default class Gantt {
  constructor(wrapper, tasks, options) {
    this.setupWrapper(wrapper);
    this.setupOptions(options);
    this.setupTasks(tasks);
    // initialize with default view mode
    this.changeViewMode();
    this.bindEvents();
  }

  setupWrapper(element) {
    let svgElement; let
      wrapperElement;

    // CSS Selector is passed
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }

    // get the SVGElement
    if (element instanceof HTMLElement) {
      wrapperElement = element;
      svgElement = element.querySelector('svg');
    } else if (element instanceof SVGElement) {
      svgElement = element;
    } else {
      throw new TypeError(
        'Frappé Gantt only supports usage of a string CSS selector,'
          + " HTML DOM element or SVG DOM element for the 'element' parameter",
      );
    }

    // svg element
    if (!svgElement) {
      // create it
      this.$svg = createSVG('svg', {
        appendTo: wrapperElement,
        class: 'gantt',
      });
    } else {
      this.$svg = svgElement;
      this.$svg.classList.add('gantt');
    }

    // wrapper element
    this.$container = document.createElement('div');
    this.$container.classList.add('gantt-container');

    const { parentElement } = this.$svg;
    parentElement.appendChild(this.$container);
    this.$container.appendChild(this.$svg);

    // popup wrapper
    this.popupWrapper = document.createElement('div');
    this.popupWrapper.classList.add('popup-wrapper');
    this.$container.appendChild(this.popupWrapper);
  }

  setupOptions(options) {
    const defaultOptions = {
      headerHeight: 50,
      columnWidth: 30,
      step: 24,
      viewModes: [...Object.values(VIEW_MODE)],
      barHeight: 20,
      barCornerRadius: 3,
      arrowCurve: 5,
      padding: 18,
      viewMode: 'Day',
      dateFormat: 'YYYY-MM-DD',
      popupTrigger: 'click',
      customPopupHtml: null,
      language: 'en',
    };
    this.options = { ...defaultOptions, ...options };
  }

  setupTasks(tasks) {
    // prepare tasks
    this.tasks = tasks.map((task, i) => {
      // convert to Date objects
      task.Start = DateUtils.parse(task.start);
      task.End = DateUtils.parse(task.end);

      // make task invalid if duration too large
      if (DateUtils.diff(task.End, task.Start, 'year') > 10) {
        task.end = null;
      }

      // cache index
      task.Index = i;

      // invalid dates
      if (!task.start && !task.end) {
        const today = DateUtils.today();
        task.Start = today;
        task.End = DateUtils.add(today, 2, 'day');
      }

      if (!task.start && task.end) {
        task.Start = DateUtils.add(task.End, -2, 'day');
      }

      if (task.start && !task.end) {
        task.End = DateUtils.add(task.Start, 2, 'day');
      }

      // if hours is not set, assume the last day is full day
      // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
      const taskEndValues = DateUtils.getDateValues(task.End);
      if (taskEndValues.slice(3).every((d) => d === 0)) {
        task.End = DateUtils.add(task.End, 24, 'hour');
      }

      // invalid flag
      if (!task.start || !task.end) {
        task.invalid = true;
      }

      // dependencies
      if (typeof task.dependencies === 'string' || !task.dependencies) {
        let deps = [];
        if (task.dependencies) {
          deps = task.dependencies
            .split(',')
            .map((d) => d.trim())
            .filter((d) => d);
        }
        task.dependencies = deps;
      }

      // uids
      if (!task.id) {
        task.id = generateId(task);
      }

      return task;
    });

    this.setupDependencies();
  }

  setupDependencies() {
    this.dependencyMap = {};
    this.tasks.forEach((t) => {
      t.dependencies.forEach((d) => {
        this.dependencyMap[d] = this.dependencyMap[d] || [];
        this.dependencyMap[d].push(t.id);
      });
    });
  }

  refresh(tasks) {
    this.setupTasks(tasks);
    this.changeViewMode();
  }

  changeViewMode(mode = this.options.viewMode) {
    this.updateViewScale(mode);
    this.setupDates();
    this.render();
    // fire viewmodeChange event
    this.triggerEvent('viewChange', [mode]);
  }

  updateViewScale(viewMode) {
    this.options.viewMode = viewMode;

    if (viewMode === VIEW_MODE.HOUR) {
      this.options.step = 24 / 24;
      this.options.columnWidth = 38;
    } else if (viewMode === VIEW_MODE.DAY) {
      this.options.step = 24;
      this.options.columnWidth = 38;
    } else if (viewMode === VIEW_MODE.HALFDAY) {
      this.options.step = 24 / 2;
      this.options.columnWidth = 38;
    } else if (viewMode === VIEW_MODE.QUARTERDAY) {
      this.options.step = 24 / 4;
      this.options.columnWidth = 38;
    } else if (viewMode === VIEW_MODE.WEEK) {
      this.options.step = 24 * 7;
      this.options.columnWidth = 140;
    } else if (viewMode === VIEW_MODE.MONTH) {
      this.options.step = 24 * 30;
      this.options.columnWidth = 120;
    } else if (viewMode === VIEW_MODE.YEAR) {
      this.options.step = 24 * 365;
      this.options.columnWidth = 120;
    }
  }

  setupDates() {
    this.setupGanttDates();
    this.setupDateValues();
  }

  setupGanttDates() {
    this.ganttStart = null;
    this.ganttEnd = null;

    this.tasks.forEach((task) => {
      // set global start and end date
      if (!this.ganttStart || task.Start < this.ganttStart) {
        this.ganttStart = task.Start;
      }
      if (!this.ganttEnd || task.End > this.ganttEnd) {
        this.ganttEnd = task.End;
      }
    });

    this.ganttStart = DateUtils.startOf(this.ganttStart, 'day');
    this.ganttEnd = DateUtils.startOf(this.ganttEnd, 'day');

    // add date padding on both sides
    if (this.viewIs([VIEW_MODE.HOUR, VIEW_MODE.QUARTERDAY, VIEW_MODE.HALFDAY])) {
      this.ganttStart = DateUtils.add(this.ganttStart, -7, 'day');
      this.ganttEnd = DateUtils.add(this.ganttEnd, 7, 'day');
    } else if (this.viewIs(VIEW_MODE.MONTH)) {
      this.ganttStart = DateUtils.startOf(this.ganttStart, 'year');
      this.ganttEnd = DateUtils.add(this.ganttEnd, 1, 'year');
    } else if (this.viewIs(VIEW_MODE.YEAR)) {
      this.ganttStart = DateUtils.add(this.ganttStart, -2, 'year');
      this.ganttEnd = DateUtils.add(this.ganttEnd, 2, 'year');
    } else {
      this.ganttStart = DateUtils.add(this.ganttStart, -1, 'month');
      this.ganttEnd = DateUtils.add(this.ganttEnd, 1, 'month');
    }
  }

  setupDateValues() {
    this.dates = [];
    let curDate = null;

    while (curDate === null || curDate < this.ganttEnd) {
      if (!curDate) {
        curDate = DateUtils.clone(this.ganttStart);
      } else if (this.viewIs(VIEW_MODE.YEAR)) {
        curDate = DateUtils.add(curDate, 1, 'year');
      } else if (this.viewIs(VIEW_MODE.MONTH)) {
        curDate = DateUtils.add(curDate, 1, 'month');
      } else {
        curDate = DateUtils.add(curDate, this.options.step, 'hour');
      }
      this.dates.push(curDate);
    }
  }

  bindEvents() {
    this.bindGridClick();
    this.bindBarEvents();
  }

  render() {
    this.clear();
    this.setupLayers();
    this.makeGrid();
    this.makeDates();
    this.makeBars();
    this.makeArrows();
    this.mapArrowsOnBars();
    this.setWidth();
    this.setScrollPosition();
  }

  setupLayers() {
    this.layers = {};
    const layers = ['grid', 'date', 'arrow', 'progress', 'bar', 'details'];
    // make group layers
    layers.forEach((layer) => {
      this.layers[layer] = createSVG('g', {
        class: layer,
        appendTo: this.$svg,
      });
    });
  }

  makeGrid() {
    this.makeGridBackground();
    this.makeGridRows();
    this.makeGridHeader();
    this.makeGridTicks();
    this.makeGridHighlights();
  }

  makeGridBackground() {
    const gridWidth = this.dates.length * this.options.columnWidth;
    const gridHeight = this.options.headerHeight
      + this.options.padding
      + (this.options.barHeight + this.options.padding) * this.tasks.length;

    createSVG('rect', {
      x: 0,
      y: 0,
      width: gridWidth,
      height: gridHeight,
      class: 'grid-background',
      appendTo: this.layers.grid,
    });

    SVGUtils.attr(this.$svg, {
      height: gridHeight + this.options.padding + 100,
      width: '100%',
    });
  }

  makeGridRows() {
    const rowsLayer = createSVG('g', { appendTo: this.layers.grid });
    const linesLayer = createSVG('g', { appendTo: this.layers.grid });

    const rowWidth = this.dates.length * this.options.columnWidth;
    const rowHeight = this.options.barHeight + this.options.padding;

    let rowY = this.options.headerHeight + this.options.padding / 2;

    this.tasks.forEach(() => {
      createSVG('rect', {
        x: 0,
        y: rowY,
        width: rowWidth,
        height: rowHeight,
        class: 'grid-row',
        appendTo: rowsLayer,
      });

      createSVG('line', {
        x1: 0,
        y1: rowY + rowHeight,
        x2: rowWidth,
        y2: rowY + rowHeight,
        class: 'row-line',
        appendTo: linesLayer,
      });

      rowY += this.options.barHeight + this.options.padding;
    });
  }

  makeGridHeader() {
    const headerWidth = this.dates.length * this.options.columnWidth;
    const headerHeight = this.options.headerHeight + 10;
    createSVG('rect', {
      x: 0,
      y: 0,
      width: headerWidth,
      height: headerHeight,
      class: 'grid-header',
      appendTo: this.layers.grid,
    });
  }

  makeGridTicks() {
    let tickX = 0;
    const tickY = this.options.headerHeight + this.options.padding / 2;
    const tickHeight = (this.options.barHeight + this.options.padding) * this.tasks.length;

    this.dates.forEach((date) => {
      let tickClass = 'tick';
      // thick tick for monday
      if (this.viewIs(VIEW_MODE.DAY) && date.getDate() === 1) {
        tickClass += ' thick';
      }
      // thick tick for first week
      if (
        this.viewIs(VIEW_MODE.WEEK)
        && date.getDate() >= 1
        && date.getDate() < 8
      ) {
        tickClass += ' thick';
      }
      // thick ticks for quarters
      if (this.viewIs(VIEW_MODE.MONTH) && (date.getMonth() + 1) % 3 === 0) {
        tickClass += ' thick';
      }

      createSVG('path', {
        d: `M ${tickX} ${tickY} v ${tickHeight}`,
        class: tickClass,
        appendTo: this.layers.grid,
      });

      if (this.viewIs(VIEW_MODE.MONTH)) {
        tickX
          += (DateUtils.getDaysInMonth(date) * this.options.columnWidth) / 30;
      } else {
        tickX += this.options.columnWidth;
      }
    });
  }

  makeGridHighlights() {
    // highlight today's date
    if (this.viewIs(VIEW_MODE.DAY)) {
      const x = (DateUtils.diff(DateUtils.today(), this.ganttStart, 'hour')
        / this.options.step)
        * this.options.columnWidth;
      const y = 0;

      const width = this.options.columnWidth;
      const height = (this.options.barHeight + this.options.padding) * this.tasks.length
        + this.options.headerHeight
        + this.options.padding / 2;

      createSVG('rect', {
        x,
        y,
        width,
        height,
        class: 'today-highlight',
        appendTo: this.layers.grid,
      });
    }
  }

  makeDates() {
    this.getDatesToDraw().forEach((date) => {
      createSVG('text', {
        x: date.lowerX,
        y: date.lowerY,
        innerHTML: date.lowerText,
        class: 'lower-text',
        appendTo: this.layers.date,
      });

      if (date.upperText) {
        const $upperText = createSVG('text', {
          x: date.upperX,
          y: date.upperY,
          innerHTML: date.upperText,
          class: 'upper-text',
          appendTo: this.layers.date,
        });

        // remove out-of-bound dates
        if ($upperText.getBBox().x2 > this.layers.grid.getBBox().width) {
          $upperText.remove();
        }
      }
    });
  }

  getDatesToDraw() {
    let lastDate = null;
    const dates = this.dates.map((date, i) => {
      const d = this.getDateInfo(date, lastDate, i);
      lastDate = date;
      return d;
    });
    return dates;
  }

  getDateInfo(date, lastDate, i) {
    if (!lastDate) {
      lastDate = DateUtils.add(date, 1, 'year');
    }
    const dateText = {
      HourLower: DateUtils.format(date, 'HH', this.options.language),
      'Quarter DayLower': DateUtils.format(date, 'HH', this.options.language),
      'Half DayLower': DateUtils.format(date, 'HH', this.options.language),
      DayLower:
        date.getDate() !== lastDate.getDate()
          ? DateUtils.format(date, 'D', this.options.language)
          : '',
      WeekLower:
        date.getMonth() !== lastDate.getMonth()
          ? DateUtils.format(date, 'D MMM', this.options.language)
          : DateUtils.format(date, 'D', this.options.language),
      MonthLower: DateUtils.format(date, 'MMMM', this.options.language),
      YearLower: DateUtils.format(date, 'YYYY', this.options.language),
      HourUpper: date.getDate() !== lastDate.getDate() ? DateUtils.format(date, 'D MMM', this.options.language) : '',
      'Quarter DayUpper':
        date.getDate() !== lastDate.getDate()
          ? DateUtils.format(date, 'D MMM', this.options.language)
          : '',
      'Half DayUpper':
        date.getDate() !== lastDate.getDate()
          ? date.getMonth() !== lastDate.getMonth()
            ? DateUtils.format(date, 'D MMM', this.options.language)
            : DateUtils.format(date, 'D', this.options.language)
          : '',
      DayUpper:
        date.getMonth() !== lastDate.getMonth()
          ? DateUtils.format(date, 'MMMM', this.options.language)
          : '',
      WeekUpper:
        date.getMonth() !== lastDate.getMonth()
          ? DateUtils.format(date, 'MMMM', this.options.language)
          : '',
      MonthUpper:
        date.getFullYear() !== lastDate.getFullYear()
          ? DateUtils.format(date, 'YYYY', this.options.language)
          : '',
      YearUpper:
        date.getFullYear() !== lastDate.getFullYear()
          ? DateUtils.format(date, 'YYYY', this.options.language)
          : '',
    };

    const basePos = {
      x: i * this.options.columnWidth,
      lowerY: this.options.headerHeight,
      upperY: this.options.headerHeight - 25,
    };

    const xPos = {
      HourLower: 0,
      HourUpper: (this.options.columnWidth * 24) / 2,
      'Quarter DayLower': (this.options.columnWidth * 4) / 2,
      'Quarter DayUpper': 0,
      'Half DayLower': (this.options.columnWidth * 2) / 2,
      'Half DayUpper': 0,
      DayLower: this.options.columnWidth / 2,
      DayUpper: (this.options.columnWidth * 30) / 2,
      WeekLower: 0,
      WeekUpper: (this.options.columnWidth * 4) / 2,
      MonthLower: this.options.columnWidth / 2,
      MonthUpper: (this.options.columnWidth * 12) / 2,
      YearLower: this.options.columnWidth / 2,
      YearUpper: (this.options.columnWidth * 30) / 2,
    };

    return {
      upperText: dateText[`${this.options.viewMode}Upper`],
      lowerText: dateText[`${this.options.viewMode}Lower`],
      upperX: basePos.x + xPos[`${this.options.viewMode}Upper`],
      upperY: basePos.upperY,
      lowerX: basePos.x + xPos[`${this.options.viewMode}Lower`],
      lowerY: basePos.lowerY,
    };
  }

  makeBars() {
    this.bars = this.tasks.map((task) => {
      const bar = new Bar(this, task);
      this.layers.bar.appendChild(bar.group);
      return bar;
    });
  }

  makeArrows() {
    this.arrows = [];
    this.tasks.forEach((task) => {
      let arrows = [];
      arrows = task.dependencies
        .map((taskId) => {
          const dependency = this.getTask(taskId);
          if (!dependency) return null;
          const arrow = new Arrow(
            this,
            this.bars[dependency.Index], // fromTask
            this.bars[task.Index], // toTask
          );
          this.layers.arrow.appendChild(arrow.element);

          return arrow;
        })
        .filter(Boolean); // filter falsy values
      this.arrows = this.arrows.concat(arrows);
    });
  }

  mapArrowsOnBars() {
    this.bars.forEach((bar) => {
      bar.arrows = this.arrows.filter((arrow) => (
        arrow.fromTask.task.id === bar.task.id
          || arrow.toTask.task.id === bar.task.id
      ));
    });
  }

  setWidth() {
    const curWidth = this.$svg.getBoundingClientRect().width;
    const actualWidth = this.$svg
      .querySelector('.grid .grid-row')
      .getAttribute('width');
    if (curWidth < actualWidth) {
      this.$svg.setAttribute('width', actualWidth);
    }
  }

  setScrollPosition() {
    const { parentElement } = this.$svg;
    if (!parentElement) return;

    const hoursBeforeFirstTask = DateUtils.diff(
      this.getOldestStartingDate(),
      this.ganttStart,
      'hour',
    );

    const scrollPos = (hoursBeforeFirstTask / this.options.step) * this.options.columnWidth
      - this.options.columnWidth;

    parentElement.scrollLeft = scrollPos;
  }

  bindGridClick() {
    SVGUtils.on(
      this.$svg,
      this.options.popupTrigger,
      '.grid-row, .grid-header',
      () => {
        this.unselectAll();
        this.hidePopup();
      },
    );
  }

  bindBarEvents() {
    let isDragging = false;
    let xOnStart = 0;
    // let yOnStart = 0;
    let isResizingLeft = false;
    let isResizingRight = false;
    let parentBarId = null;
    let bars = []; // instanceof Bar
    this.barBeingDragged = null;

    function actionInProgress() {
      return isDragging || isResizingLeft || isResizingRight;
    }

    SVGUtils.on(this.$svg, 'mousedown', '.bar-wrapper, .handle', (e, element) => {
      const barWrapper = SVGUtils.closest('.bar-wrapper', element);

      if (element.classList.contains('left')) {
        isResizingLeft = true;
      } else if (element.classList.contains('right')) {
        isResizingRight = true;
      } else if (element.classList.contains('bar-wrapper')) {
        isDragging = true;
      }

      barWrapper.classList.add('active');

      xOnStart = e.offsetX;
      // yOnStart = e.offsetY;

      parentBarId = barWrapper.getAttribute('data-id');
      const ids = [
        parentBarId,
        ...this.getAllDependentTasks(parentBarId),
      ];
      bars = ids.map((id) => this.getBar(id));

      this.barBeingDragged = parentBarId;

      bars.forEach((bar) => {
        const { $bar } = bar;
        $bar.ox = $bar.getX();
        $bar.oy = $bar.getY();
        $bar.owidth = $bar.getWidth();
        $bar.finaldx = 0;
      });
    });

    SVGUtils.on(this.$svg, 'mousemove', (e) => {
      if (!actionInProgress()) return;
      const dx = e.offsetX - xOnStart;
      // const dy = e.offsetY - yOnStart;

      bars.forEach((bar) => {
        const { $bar } = bar;
        $bar.finaldx = this.getSnapPosition(dx);
        this.hidePopup();
        if (isResizingLeft) {
          if (parentBarId === bar.task.id) {
            bar.updateBarPosition({
              x: $bar.ox + $bar.finaldx,
              width: $bar.owidth - $bar.finaldx,
            });
          } else {
            bar.updateBarPosition({
              x: $bar.ox + $bar.finaldx,
            });
          }
        } else if (isResizingRight) {
          if (parentBarId === bar.task.id) {
            bar.updateBarPosition({
              width: $bar.owidth + $bar.finaldx,
            });
          }
        } else if (isDragging) {
          bar.updateBarPosition({ x: $bar.ox + $bar.finaldx });
        }
      });
    });

    document.addEventListener('mouseup', () => {
      if (isDragging || isResizingLeft || isResizingRight) {
        bars.forEach((bar) => bar.group.classList.remove('active'));
      }

      isDragging = false;
      isResizingLeft = false;
      isResizingRight = false;
    });

    SVGUtils.on(this.$svg, 'mouseup', () => {
      this.barBeingDragged = null;
      bars.forEach((bar) => {
        const { $bar } = bar;
        if (!$bar.finaldx) return;
        bar.dateChanged();
        bar.setActionCompleted();
      });
    });

    this.bindBarProgress();
  }

  bindBarProgress() {
    let xOnStart = 0;
    // let yOnStart = 0;
    let isResizing = null;
    let bar = null;
    let $barProgress = null;
    let $bar = null;

    SVGUtils.on(this.$svg, 'mousedown', '.handle.progress', (e, handle) => {
      isResizing = true;
      xOnStart = e.offsetX;
      // yOnStart = e.offsetY;

      const $barWrapper = SVGUtils.closest('.bar-wrapper', handle);
      const id = $barWrapper.getAttribute('data-id');
      bar = this.getBar(id);

      $barProgress = bar.$barProgress;
      $bar = bar.$bar;

      $barProgress.finaldx = 0;
      $barProgress.owidth = $barProgress.getWidth();
      $barProgress.minDx = -$barProgress.getWidth();
      $barProgress.maxDx = $bar.getWidth() - $barProgress.getWidth();
    });

    SVGUtils.on(this.$svg, 'mousemove', (e) => {
      if (!isResizing) return;
      let dx = e.offsetX - xOnStart;
      // const dy = e.offsetY - yOnStart;

      if (dx > $barProgress.maxDx) {
        dx = $barProgress.maxDx;
      }
      if (dx < $barProgress.minDx) {
        dx = $barProgress.minDx;
      }

      const $handle = bar.$handleProgress;
      SVGUtils.attr($barProgress, 'width', $barProgress.owidth + dx);
      SVGUtils.attr($handle, 'points', bar.getProgressPolygonPoints());
      $barProgress.finaldx = dx;
    });

    SVGUtils.on(this.$svg, 'mouseup', () => {
      isResizing = false;
      if (!($barProgress && $barProgress.finaldx)) return;
      bar.progressChanged();
      bar.setActionCompleted();
    });
  }

  getAllDependentTasks(taskId) {
    let out = [];
    let toProcess = [taskId];
    while (toProcess.length) {
      const deps = toProcess.reduce((acc, curr) => {
        acc = acc.concat(this.dependencyMap[curr]);
        return acc;
      }, []);

      out = out.concat(deps);
      // eslint-disable-next-line no-loop-func
      toProcess = deps.filter((d) => !toProcess.includes(d));
    }

    return out.filter(Boolean);
  }

  getSnapPosition(dx) {
    const odx = dx;
    let rem;
    let position;

    if (this.viewIs(VIEW_MODE.WEEK)) {
      rem = dx % (this.options.columnWidth / 7);
      position = odx
        - rem
        + (rem < this.options.columnWidth / 14
          ? 0
          : this.options.columnWidth / 7);
    } else if (this.viewIs(VIEW_MODE.MONTH)) {
      rem = dx % (this.options.columnWidth / 30);
      position = odx
        - rem
        + (rem < this.options.columnWidth / 60
          ? 0
          : this.options.columnWidth / 30);
    } else {
      rem = dx % this.options.columnWidth;
      position = odx
        - rem
        + (rem < this.options.columnWidth / 2 ? 0 : this.options.columnWidth);
    }
    return position;
  }

  unselectAll() {
    [...this.$svg.querySelectorAll('.bar-wrapper')].forEach((el) => {
      el.classList.remove('active');
    });
  }

  viewIs(modes) {
    if (typeof modes === 'string') {
      return this.options.viewMode === modes;
    }

    if (Array.isArray(modes)) {
      return modes.some((mode) => this.options.viewMode === mode);
    }

    return false;
  }

  getTask(id) {
    return this.tasks.find((task) => task.id === id);
  }

  getBar(id) {
    return this.bars.find((bar) => bar.task.id === id);
  }

  showPopup(options) {
    if (!this.popup) {
      this.popup = new Popup(
        this.popupWrapper,
        this.options.customPopupHtml,
      );
    }
    this.popup.show(options);
  }

  hidePopup() {
    if (this.popup) this.popup.hide();
  }

  triggerEvent(event, args) {
    if (this.options[`on${event}`]) {
      this.options[`on${event}`].apply(null, args);
    }
  }

  /**
   * Gets the oldest starting date from the list of tasks
   *
   * @returns Date
   * @memberof Gantt
   */
  getOldestStartingDate() {
    return this.tasks
      .map((task) => task.Start)
      .reduce(
        (prevDate, curDate) => (curDate <= prevDate ? curDate : prevDate),
      );
  }

  /**
   * Clear all elements from the parent svg element
   *
   * @memberof Gantt
   */
  clear() {
    this.$svg.innerHTML = '';
  }
}

Gantt.VIEW_MODE = VIEW_MODE;
