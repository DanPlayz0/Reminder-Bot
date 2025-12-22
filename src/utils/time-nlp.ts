/**
 * @credits https://github.com/NotSoBot/notsobot.ts/blob/master/src/utils/parameters/index.ts
 */
import * as chrono from 'chrono-node';
import { getTimezoneAbbreviation, getTimezoneFromContext } from './timezone';

export interface NLPTimestampResult {
  content: string,
  contentTimestamp: string,
  end: Date | null,
  start: Date,
}

const customChrono = chrono.casual.clone();
customChrono.refiners.push({
  refine: (context, results) => {
    // If there is no AM/PM (meridiem) specified,
    // let all time between 1:00 - 5:00 be PM (13.00 - 17.00)
    for (let result of results) {
      // only continue if hour is specified AND meridiem is not specified
      // e.g. `next week at 5` (`next week at 5 pm` will be skipped)
      if (result.start.isCertain('hour') && !result.start.isCertain('meridiem')) {
        const hour = (result.start.get('hour') || 0);
        if (1 <= hour && hour <= 5) {
          result.start.assign('meridiem', 1);
          result.start.assign('hour', hour + 12);
        }
      }
    }
    return results;
  },
});


function mergeText(text1: string, text2: string): string {
  if (text1.endsWith(' ') && text2.startsWith(' ')) {
    return text1 + text2.slice(1);
  }
  return text1 + text2;
}

const IGNORE_WORDS = ['in', 'and', 'about', 'to', 'between'];
export function nlpTimestamp(
  value: string,
  context: { instant?: Date; userId?: string; guildId?: string; timezone?: string } = {},
): NLPTimestampResult {
  let instant: Date = context.instant ?? new Date();

  const results = customChrono.parse(value, {
    instant,
    timezone: context.timezone,//: getTimezoneAbbreviation(getTimezoneFromContext(context)),
  }, {forwardDate: true});
  if (!results.length) {
    throw new Error('Must provide some sort of time in your text');
  }

  /*
   - 'about elon musk in 5 days and 5 minutes' == [{text: '5 days'}, {text: '5 minutes'}]
   - 'in 5 days and 5 minutes about elon musk' == [{text: '5 days'}, {text: '5 minutes'}]
   - 'next friday at 4pm do something funny' == [{text: 'next friday at 4pm'}]
   - 'do the laundry tomorrow' == [{text: 'tomorrow'}]
   - '2d unmute me' == []
   - 'cake in 5 days about lol' == [{text: 'in 5 days'}]
  */

  let content: string = '';
  let contentTimestamp: string = '';
  let lastIndex = 0;

  const now = Date.now();

  let end = 0;
  let start = 0;
  for (let result of results) {
    const text = value.slice(lastIndex, result.index);
    lastIndex = result.index + result.text.length; // 25, 30

    if (IGNORE_WORDS.includes(text.trim())) {
      contentTimestamp += text;
    } else {
      content = mergeText(content, text);
    }
    contentTimestamp += result.text;

    // add up the time

    start += (result.start.date().getTime() - now);
    if (result.end) {
      end += (result.end.date().getTime() - now);
    }
  }
  content = mergeText(content, value.slice(lastIndex)).trim();
  contentTimestamp = contentTimestamp.trim();

  const insensitiveParts = content.toLowerCase().split(' ');
  if (IGNORE_WORDS.includes(insensitiveParts[0])) {
    content = content.slice(insensitiveParts[0].length).trim();
  }
  if (1 < insensitiveParts.length && IGNORE_WORDS.includes(insensitiveParts[insensitiveParts.length - 1])) {
    content = content.slice(0, content.length - insensitiveParts[insensitiveParts.length - 1].length).trim();
  }

  return {
    end: (end) ? new Date(instant.getTime() + end) : null,
    content,
    contentTimestamp,
    start: new Date(instant.getTime() + start),
  };
}