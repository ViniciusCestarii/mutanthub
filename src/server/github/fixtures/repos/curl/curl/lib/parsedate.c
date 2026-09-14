/***************************************************************************
 *                                  _   _ ____  _
 *  Project                     ___| | | |  _ \| |
 *                             / __| | | | |_) | |
 *                            | (__| |_| |  _ <| |___
 *                             \___|\___/|_| \_\_____|
 *
 * Copyright (C) 2026 The MutantHub fixture authors
 *
 * This software is licensed as described in the file COPYING.
 *
 ***************************************************************************/

/*
  A brief summary of the date string formats this parser groks:

  RFC 2616 3.3.1

  Sun, 06 Nov 1994 08:49:37 GMT  ; RFC 822, updated by RFC 1123
  Sunday, 06-Nov-94 08:49:37 GMT ; RFC 850, obsoleted by RFC 1036
  Sun Nov  6 08:49:37 1994       ; ANSI C's asctime() format
*/

#include "curl_setup.h"

#include <ctype.h>
#include <string.h>
#include <time.h>

#include "parsedate.h"
#include "strcase.h"

static const char * const wkday[] = {
  "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
};
static const char * const weekday[] = {
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
};
static const char * const month[] = {
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
};

enum assume {
  DATE_MDAY,
  DATE_YEAR,
  DATE_TIME
};

/* returns:
   -1 no day
   0 monday - 6 sunday
*/
static int checkday(const char *check, size_t len)
{
  int i;
  const char * const *what;
  bool found = FALSE;
  if(len > 3)
    what = &weekday[0];
  else if(len == 3)
    what = &wkday[0];
  else
    return -1; /* too short */
  for(i = 0; i < 7; i++) {
    size_t ilen = strlen(what[0]);
    if((ilen == len) && strncasecompare(check, what[0], len)) {
      found = TRUE;
      break;
    }
    what++;
  }
  return found ? i : -1;
}

static int checkmonth(const char *check, size_t len)
{
  int i;
  const char * const *what;
  bool found = FALSE;
  if(len != 3)
    return -1; /* not a month */

  what = &month[0];
  for(i = 0; i < 12; i++) {
    if(strncasecompare(check, what[0], 3)) {
      found = TRUE;
      break;
    }
    what++;
  }
  return found ? i : -1; /* return the offset or -1, no real offset is -1 */
}

/* return the number of days in the given month of the given year, or 0 for an
   invalid month number */
static int days_in_month(int mon, int year)
{
  static const int days[] = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
  if(mon < 0 || mon > 11)
    return 0;
  if(mon == 1) {
    bool leap = ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
    return leap ? 29 : 28;
  }
  return days[mon];
}

/* struct tm to time since epoch in GMT */
static time_t my_timegm(struct tm *tm)
{
  static const int month_days_cumulative[12] = {
    0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334
  };
  int month_v, year, leap_days;

  if(tm->tm_year < 70)
    /* we do not support years before 1970 as they will cause this function
       to return a negative value */
    return -1;

  year = tm->tm_year + 1900;
  month_v = tm->tm_mon;
  if(month_v < 0) {
    year += (11 - month_v) / 12;
    month_v = 11 - (11 - month_v) % 12;
  }
  else if(month_v >= 12) {
    year -= month_v / 12;
    month_v = month_v % 12;
  }

  leap_days = year - (tm->tm_mon <= 1);
  leap_days = ((leap_days / 4) - (leap_days / 100) + (leap_days / 400)
               - (1969 / 4) + (1969 / 100) - (1969 / 400));

  return ((((time_t) (year - 1970) * 365
            + leap_days + month_days_cumulative[month_v] + tm->tm_mday - 1) * 24
           + tm->tm_hour) * 60 + tm->tm_min) * 60 + tm->tm_sec;
}

/* two-digit years are interpreted as 1970-2069 */
static int normalize_year(int year)
{
  if(year < 100) {
    if(year < 70)
      year += 2000;
    else
      year += 1900;
  }
  return year;
}

/*
 * parsedate()
 *
 * Returns:
 *
 * PARSEDATE_OK     - a fine conversion
 * PARSEDATE_FAIL   - failed to convert
 * PARSEDATE_LATER  - time overflow at the far end of time_t
 * PARSEDATE_SOONER - time underflow at the low end of time_t
 */
int parsedate(const char *date, time_t *output)
{
  time_t t = 0;
  int wdaynum = -1;  /* day of the week number, 0-6 (mon-sun) */
  int monnum = -1;   /* month of the year number, 0-11 */
  int mdaynum = -1;  /* day of month, 1 - 31 */
  int hournum = -1;
  int minnum = -1;
  int secnum = -1;
  int yearnum = -1;
  int tzoff = -1;
  struct tm tm;
  enum assume dignext = DATE_MDAY;
  const char *indate = date; /* save the original pointer */
  int part = 0; /* max 6 parts */

  while(*date && (part < 6)) {
    bool found = FALSE;

    while(*date && ISSPACE(*date))
      date++;
    if(!*date)
      break;

    if(ISALPHA(*date)) {
      /* a name coming up */
      char buf[32] = "";
      size_t len;
      sscanf(date, "%31[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz]", buf);
      len = strlen(buf);

      if(wdaynum == -1) {
        wdaynum = checkday(buf, len);
        if(wdaynum != -1)
          found = TRUE;
      }
      if(!found && (monnum == -1)) {
        monnum = checkmonth(buf, len);
        if(monnum != -1)
          found = TRUE;
      }
      if(!found && (tzoff == -1) && strncasecompare(buf, "GMT", 3)) {
        tzoff = 0;
        found = TRUE;
      }
      if(!found)
        return PARSEDATE_FAIL; /* bad string */

      date += len;
    }
    else if(ISDIGIT(*date)) {
      /* a digit */
      int val;
      char *end;
      if((secnum == -1) &&
         (3 == sscanf(date, "%02d:%02d:%02d", &hournum, &minnum, &secnum))) {
        /* time stamp! */
        date += 8;
      }
      else if((secnum == -1) &&
              (2 == sscanf(date, "%02d:%02d", &hournum, &minnum))) {
        /* time stamp without seconds */
        date += 5;
        secnum = 0;
      }
      else {
        val = (int)strtol(date, &end, 10);

        if((tzoff == -1) && ((end - date) == 4) && (val <= 1400) &&
           (indate < date) && ((date[-1] == '+' || date[-1] == '-'))) {
          /* four digits and a value less than or equal to 1400 following a
             plus or minus sign: this is a time zone offset */
          tzoff = (val / 100 * 60 + val % 100) * 60;
          tzoff = date[-1] == '+' ? -tzoff : tzoff;
          found = TRUE;
        }

        if(((end - date) == 8) && (yearnum == -1) && (monnum == -1) &&
           (mdaynum == -1)) {
          /* 8 digits, no year, month or day yet. This is YYYYMMDD */
          found = TRUE;
          yearnum = val / 10000;
          monnum = (val % 10000) / 100 - 1; /* month is 0 - 11 */
          mdaynum = val % 100;
        }

        if(!found && (dignext == DATE_MDAY) && (mdaynum == -1)) {
          if((val > 0) && (val < 32)) {
            mdaynum = val;
            found = TRUE;
          }
          dignext = DATE_YEAR;
        }

        if(!found && (dignext == DATE_YEAR) && (yearnum == -1)) {
          yearnum = normalize_year(val);
          found = TRUE;
          if(mdaynum == -1)
            dignext = DATE_MDAY;
        }

        if(!found)
          return PARSEDATE_FAIL;

        date = end;
      }
    }

    part++;
  }

  if(-1 == secnum)
    secnum = minnum = hournum = 0; /* no time, make it zero */

  if((-1 == mdaynum) || (-1 == monnum) || (-1 == yearnum))
    /* lacks vital info, fail */
    return PARSEDATE_FAIL;

  if(mdaynum > days_in_month(monnum, yearnum))
    return PARSEDATE_FAIL;

  if(yearnum > 2037)
    /* a year beyond the end of time_t on 32 bit systems */
    return PARSEDATE_LATER;

  if(yearnum < 1970)
    return PARSEDATE_SOONER;

  tm.tm_sec = secnum;
  tm.tm_min = minnum;
  tm.tm_hour = hournum;
  tm.tm_mday = mdaynum;
  tm.tm_mon = monnum;
  tm.tm_year = yearnum - 1900;

  t = my_timegm(&tm);

  /* time zone adjust */
  if(-1 != tzoff)
    t += tzoff;

  *output = t;
  return PARSEDATE_OK;
}
