import si from "systeminformation";

export class MetricsCollector {
  async snapshot() {
    const [load, memory, disks, network] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
    ]);

    const disk = disks[0];
    const stats = network[0];

    return {
      cpuPercent: load.currentLoad,
      memoryUsedMb: memory.used / 1024 / 1024,
      memoryTotalMb: memory.total / 1024 / 1024,
      diskUsedMb: (disk?.used ?? 0) / 1024 / 1024,
      diskTotalMb: (disk?.size ?? 0) / 1024 / 1024,
      networkRxBytes: stats?.rx_bytes ?? 0,
      networkTxBytes: stats?.tx_bytes ?? 0,
    };
  }
}
