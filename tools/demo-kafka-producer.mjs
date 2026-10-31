#!/usr/bin/env node
/*
 * 시연용 Kafka 생산기 — 모니터링 경보 이벤트를 쉬지 않고 보낸다(녹화하는 동안 시나리오가 띄우고 끈다).
 *   node tools/demo-kafka-producer.mjs <토픽> [--broker localhost:9092] [--rate 8] [--seconds 300]
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { DATALAKE_REPO } from "./demo-scenarios.mjs";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { broker: { type: "string", default: "localhost:9092" }, rate: { type: "string", default: "8" }, seconds: { type: "string", default: "300" } } });
const topic = positionals[0];
if (!topic) throw new Error("사용: node tools/demo-kafka-producer.mjs <토픽>");
const { Kafka, logLevel } = createRequire(join(DATALAKE_REPO, "package.json"))("kafkajs");
const p = new Kafka({ clientId: "hnix-demo-producer", brokers: [values.broker], logLevel: logLevel.NOTHING }).producer();
await p.connect();
const hosts = ["hr-was01", "hr-was02", "hr-db01", "pay-batch01", "erp-was01", "mes-db02"];
const systems = { "hr-was01": "HR", "hr-was02": "HR", "hr-db01": "HR", "pay-batch01": "PAY", "erp-was01": "ERP", "mes-db02": "MES" };
const kinds = [
  ["info", "CPU 사용률 정상화"],
  ["warning", "응답 시간 2초 초과"],
  ["warning", "디스크 사용률 85%"],
  ["info", "세션 수 정상"],
  ["critical", "DB 세션 90% 초과"],
  ["warning", "배치 지연 10분"],
  ["info", "헬스체크 통과"],
];
let n = 0;
const end = Date.now() + Number(values.seconds) * 1000;
const every = 1000 / Number(values.rate);
const stop = async () => {
  await p.disconnect().catch(() => undefined);
  console.log(`보낸 이벤트 ${n}건`);
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
while (Date.now() < end) {
  const host = hosts[n % hosts.length];
  const [severity, message] = kinds[(n * 3 + Math.floor(n / 7)) % kinds.length];
  n++;
  await p.send({ topic, messages: [{ key: host, value: JSON.stringify({ alert_id: `ALT-${String(n).padStart(6, "0")}`, host, system: systems[host], severity, message, value: Math.round(50 + ((n * 37) % 50)), occurred_at: new Date().toISOString() }) }] });
  await new Promise((r) => setTimeout(r, every));
}
await stop();
