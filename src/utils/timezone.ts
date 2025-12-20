import moment from "moment";

export enum Timezones {
  MIT = 'Pacific/Midway',
  HST = 'US/Hawaii',
  AST = 'US/Alaska',
  PST = 'US/Pacific',
  PNT = 'America/Phoenix',
  MST = 'US/Mountain',
  CST = 'US/Central',
  EST = 'US/Eastern',
  IET = 'US/East-Indiana',
  PRT = 'Etc/GMT-4',
  CNT = 'Canada/Newfoundland',
  AGT = 'Etc/GMT-3',
  BET = 'Brazil/East',
  CAT = 'Etc/GMT-1',
  GMT = 'GMT',
  ECT = 'Etc/GMT-5',
  EET = 'EET',
  ART = 'Egypt',
  EAT = 'Etc/GMT+3',
  MET = 'MET',
  NET = 'Etc/GMT+4',
  PLT = 'Etc/GMT+5',
  IST = 'Etc/GMT+5:30',
  BST = 'Etc/GMT+6',
  VST = 'Etc/GMT+7',
  CTT = 'Etc/GMT+8',
  JST = 'Japan',
  ACT = 'Australia/ACT',
  AET = 'Etc/GMT+10',
  SST = 'Etc/GMT+11',
  NST = 'Etc/GMT+12',
}
export const TimezonesToText: Record<Timezones, string> = Object.freeze({
  [Timezones.HST]: '(GMT-10:00) Hawaii Standard Time (HST)',
  [Timezones.MIT]: '(GMT-09:30) Marquesas Islands Time (MIT)',
  [Timezones.PST]: '(GMT-08:00) Pacific Standard Time (PST)',
  [Timezones.PNT]: '(GMT-07:00) Phoenix Standard Time (PNT)',
  [Timezones.AST]: '(GMT-04:00) Atlantic Standard Time (AST)',
  [Timezones.MST]: '(GMT-07:00) Mountain Standard Time (MST)',
  [Timezones.CST]: '(GMT-06:00) Central Standard Time (CST)',
  [Timezones.EST]: '(GMT-05:00) Eastern Standard Time (EST)',
  [Timezones.IET]: '(GMT-05:00) Indiana Eastern Standard Time (IET)',
  [Timezones.PRT]: '(GMT+01:00) Western European Summer Time (CNT)',
  [Timezones.CNT]: '(GMT-03:30) Canada Newfoundland Time (CNT)',
  [Timezones.AGT]: '(GMT-03:00) Argentina Standard Time(AGT)',
  [Timezones.BET]: '(GMT-11:00) Bering Standard Time (BET)',
  [Timezones.CAT]: '(GMT+02:00) Central Africa Time (CAT)',
  [Timezones.GMT]: '(GMT+00:00) Greenwich Mean Time (GMT)',
  [Timezones.ECT]: '(GMT-05:00) Ecuador Central Time (ECT)',
  [Timezones.EET]: '(GMT+03:00) Eastern European Time (EET)',
  [Timezones.ART]: '(GMT-03:00) Argentina Time (ART)',
  [Timezones.EAT]: '(GMT+03:00) Eastern Africa Time (EAT)',
  [Timezones.MET]: '(GMT+01:00) Middle European Time (MET)', // duplicate of CET
  [Timezones.NET]: '',
  [Timezones.PLT]: '',
  [Timezones.IST]: '(GMT+05:30) India Standard Time (IST)',
  [Timezones.BST]: '(GMT+06:00) Bangladesh Standard Time (BST)',
  [Timezones.VST]: '(GMT-04:30) Venezuela Standard Time (VST)',
  [Timezones.CTT]: '',
  [Timezones.JST]: '(GMT+09:00) Japan Standard Time (JST)',
  [Timezones.ACT]: '(GMT+09:30) Australian Central Time (ACT)',
  [Timezones.AET]: '',
  [Timezones.SST]: '(GMT+02:00) Syria Standard Time (SST)',
  [Timezones.NST]: '(GMT-03:30) Newfoundland Standard Time (NST)', // duplicate of CNT
});


export function getTimezoneAbbreviation(timezone: string): string {
  return moment.tz(timezone).zoneAbbr();
}

export function getTimezoneFromContext(options: {guildId?: string, userId?: string}): string {
  // add user timezones
  let timezone: string | undefined;
  // if (options.userId) {
  //   const settings = UserSettingsStore.get(options.userId);
  //   if (settings && settings.timezone) {
  //     timezone = settings.timezone;
  //   }
  // }
  // if (!timezone && options.guildId) {
  //   const settings = GuildSettingsStore.get(options.guildId);
  //   if (settings && settings.timezone) {
  //     timezone = settings.timezone;
  //   }
  // }
  return timezone || Timezones.EST;
}