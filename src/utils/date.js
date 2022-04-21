const YEAR = 'year';
const MONTH = 'month';
const DAY = 'day';
const HOUR = 'hour';
const MINUTE = 'minute';
const SECOND = 'second';
const MILLISECOND = 'millisecond';

const MONTHNAMES = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  es: [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ],
  ru: [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ],
  ptBr: [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ],
  fr: [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ],
  tr: [
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ],
  zh: [
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
    '九月',
    '十月',
    '十一月',
    '十二月',
  ],
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/GlobalObjects/String/padStart
const padStart = (str, targetLength, padString) => {
  str += '';
  // eslint-disable-next-line no-bitwise
  targetLength >>= 0;
  padString = String(typeof padString !== 'undefined' ? padString : ' ');
  if (str.length > targetLength) {
    return String(str);
  }
  targetLength -= str.length;
  if (targetLength > padString.length) {
    padString += padString.repeat(targetLength / padString.length);
  }
  return padString.slice(0, targetLength) + String(str);
};

export default {
  parse(date, dateSeparator = '-', timeSeparator = /[.:]/) {
    if (date instanceof Date) {
      return date;
    }
    if (typeof date === 'string') {
      const parts = date.split(' ');
      const dateParts = parts[0]
        .split(dateSeparator)
        .map((val) => parseInt(val, 10));
      const timeParts = parts[1] && parts[1].split(timeSeparator);

      // month is 0 indexed
      dateParts[1] -= 1;

      let vals = dateParts;

      if (timeParts && timeParts.length) {
        if (timeParts.length === 4) {
          timeParts[3] = `0.${timeParts[3]}`;
          timeParts[3] = parseFloat(timeParts[3]) * 1000;
        }
        vals = vals.concat(timeParts);
      }

      return new Date(...vals);
    }

    return null;
  },

  toString(date, withTime = false) {
    if (!(date instanceof Date)) {
      throw new TypeError('Invalid argument type');
    }
    const vals = this.getDateValues(date).map((val, i) => {
      if (i === 1) {
        // add 1 for month
        val += 1;
      }

      if (i === 6) {
        return padStart(`${val}`, 3, '0');
      }

      return padStart(`${val}`, 2, '0');
    });
    const dateString = `${vals[0]}-${vals[1]}-${vals[2]}`;
    const timeString = `${vals[3]}:${vals[4]}:${vals[5]}.${vals[6]}`;

    return dateString + (withTime ? ` ${timeString}` : '');
  },

  format(date, formatString = 'YYYY-MM-DD HH:mm:ss.SSS', lang = 'en') {
    const values = this.getDateValues(date).map((d) => padStart(d, 2, 0));
    const formatMap = {
      YYYY: values[0],
      MM: padStart(+values[1] + 1, 2, 0),
      DD: values[2],
      HH: values[3],
      mm: values[4],
      ss: values[5],
      SSS: values[6],
      D: values[2],
      MMMM: MONTHNAMES[lang][+values[1]],
      MMM: MONTHNAMES[lang][+values[1]],
    };

    let str = formatString;
    const formattedValues = [];

    Object.keys(formatMap)
      .sort((a, b) => b.length - a.length) // big string first
      .forEach((key) => {
        if (str.includes(key)) {
          str = str.replace(key, `$${formattedValues.length}`);
          formattedValues.push(formatMap[key]);
        }
      });

    formattedValues.forEach((value, i) => {
      str = str.replace(`$${i}`, value);
    });

    return str;
  },

  diff(dateA, dateB, scale = DAY) {
    const milliseconds = dateA - dateB;
    const seconds = milliseconds / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const days = hours / 24;
    const months = days / 30;
    const years = months / 12;

    if (!scale.endsWith('s')) {
      scale += 's';
    }

    return Math.floor(
      {
        milliseconds,
        seconds,
        minutes,
        hours,
        days,
        months,
        years,
      }[scale],
    );
  },

  today() {
    const vals = this.getDateValues(new Date()).slice(0, 3);
    return new Date(...vals);
  },

  now() {
    return new Date();
  },

  add(date, qty, scale) {
    qty = parseInt(qty, 10);
    const vals = [
      date.getFullYear() + (scale === YEAR ? qty : 0),
      date.getMonth() + (scale === MONTH ? qty : 0),
      date.getDate() + (scale === DAY ? qty : 0),
      date.getHours() + (scale === HOUR ? qty : 0),
      date.getMinutes() + (scale === MINUTE ? qty : 0),
      date.getSeconds() + (scale === SECOND ? qty : 0),
      date.getMilliseconds() + (scale === MILLISECOND ? qty : 0),
    ];
    return new Date(...vals);
  },

  startOf(date, scale) {
    const scores = {
      [YEAR]: 6,
      [MONTH]: 5,
      [DAY]: 4,
      [HOUR]: 3,
      [MINUTE]: 2,
      [SECOND]: 1,
      [MILLISECOND]: 0,
    };

    const shouldReset = (timeUnit) => {
      const maxScore = scores[scale];
      return scores[timeUnit] <= maxScore;
    };

    const vals = [
      date.getFullYear(),
      shouldReset(YEAR) ? 0 : date.getMonth(),
      shouldReset(MONTH) ? 1 : date.getDate(),
      shouldReset(DAY) ? 0 : date.getHours(),
      shouldReset(HOUR) ? 0 : date.getMinutes(),
      shouldReset(MINUTE) ? 0 : date.getSeconds(),
      shouldReset(SECOND) ? 0 : date.getMilliseconds(),
    ];

    return new Date(...vals);
  },

  clone(date) {
    return new Date(...this.getDateValues(date));
  },

  getDateValues(date) {
    return [
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ];
  },

  getDaysInMonth(date) {
    const noOfDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const month = date.getMonth();

    if (month !== 1) {
      return noOfDays[month];
    }

    // Feb
    const year = date.getFullYear();
    if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
      return 29;
    }
    return 28;
  },
};
