import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = 'dist/chrome';
const output = 'dist/tale-chrome-extension.zip';

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}

const table = new Uint32Array(256);
for (let index = 0; index < table.length; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  table[index] = value >>> 0;
}
function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = table[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function header(signature, size) {
  const value = Buffer.alloc(size);
  value.writeUInt32LE(signature, 0);
  return value;
}

const local = [];
const central = [];
let offset = 0;
for (const path of await files(root)) {
  const name = Buffer.from(relative(root, path).replaceAll('\\', '/'));
  const data = await readFile(path);
  const checksum = crc32(data);
  const entry = header(0x04034b50, 30);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(0x0800, 6);
  entry.writeUInt32LE(checksum, 14);
  entry.writeUInt32LE(data.length, 18);
  entry.writeUInt32LE(data.length, 22);
  entry.writeUInt16LE(name.length, 26);
  local.push(entry, name, data);

  const directory = header(0x02014b50, 46);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(0x0800, 8);
  directory.writeUInt32LE(checksum, 16);
  directory.writeUInt32LE(data.length, 20);
  directory.writeUInt32LE(data.length, 24);
  directory.writeUInt16LE(name.length, 28);
  directory.writeUInt32LE(offset, 42);
  central.push(directory, name);
  offset += entry.length + name.length + data.length;
}
const centralData = Buffer.concat(central);
const end = header(0x06054b50, 22);
end.writeUInt16LE(central.length / 2, 8);
end.writeUInt16LE(central.length / 2, 10);
end.writeUInt32LE(centralData.length, 12);
end.writeUInt32LE(offset, 16);
await writeFile(output, Buffer.concat([...local, centralData, end]));
console.log(`Created ${output}`);
