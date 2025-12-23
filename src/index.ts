import "./sql/pool";
import './utils/moment-init';
import configuration from "./configuration";
// import cron from 'node-cron';
import findAndSendReminders from "./job/send-reminder";
import client from "./utils/client";

setInterval(() => {
  findAndSendReminders();
}, 5000);
// cron.schedule('* * * * * *', () => findAndSendReminders());
client.login(configuration.token);
