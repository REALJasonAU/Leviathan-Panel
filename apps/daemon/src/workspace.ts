import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";

import fs from "fs-extra";
import * as tar from "tar";
import type { FileEntryRecord, ServerRecord } from "@voltan/shared";

const maxTextReadBytes = 2 * 1024 * 1024;

export class WorkspaceManager {
  constructor(private readonly baseDir: string) {}

  getServerRoot(serverId: string) {
    return path.join(this.baseDir, "servers", serverId);
  }

  getBackupRoot(serverId: string) {
    return path.join(this.baseDir, "backups", serverId);
  }

  getMetadataPath(serverId: string) {
    return path.join(this.getServerRoot(serverId), "server.json");
  }

  getEnvironmentPath(serverId: string) {
    return path.join(this.getServerRoot(serverId), ".env");
  }

  async ensureBase() {
    await fs.ensureDir(path.join(this.baseDir, "servers"));
    await fs.ensureDir(path.join(this.baseDir, "backups"));
  }

  async ensureServer(server: ServerRecord) {
    const root = this.getServerRoot(server.id);
    await fs.ensureDir(root);
    await fs.ensureDir(this.getBackupRoot(server.id));
    await fs.writeJson(this.getMetadataPath(server.id), server, { spaces: 2 });
    await this.writeEnvironment(server.id, server.environment);
  }

  async loadServer(serverId: string): Promise<ServerRecord | null> {
    const metadataPath = this.getMetadataPath(serverId);
    if (!(await fs.pathExists(metadataPath))) {
      return null;
    }

    return fs.readJson(metadataPath);
  }

  async writeEnvironment(
    serverId: string,
    environment: Record<string, string>,
  ) {
    const body = Object.entries(environment)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    await fs.outputFile(this.getEnvironmentPath(serverId), `${body}\n`);
  }

  private resolvePath(
    serverId: string,
    relativePath: string,
    kind: "server" | "backup" = "server",
  ) {
    const root =
      kind === "server"
        ? this.getServerRoot(serverId)
        : this.getBackupRoot(serverId);
    const target = path.resolve(root, relativePath);
    const resolvedRoot = path.resolve(root);
    if (
      target !== resolvedRoot &&
      !target.startsWith(`${resolvedRoot}${path.sep}`)
    ) {
      throw new Error("Refusing to access outside server root");
    }
    return { root: resolvedRoot, target };
  }

  async listFiles(
    serverId: string,
    relativePath = ".",
  ): Promise<FileEntryRecord[]> {
    const { root, target } = this.resolvePath(serverId, relativePath);
    const entries = await fs.readdir(target, { withFileTypes: true });
    const rows = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(target, entry.name);
        const stats = await fs.stat(fullPath);
        return {
          name: entry.name,
          path: path.relative(root, fullPath) || ".",
          isDirectory: entry.isDirectory(),
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        };
      }),
    );
    return rows.sort(
      (left, right) =>
        Number(right.isDirectory) - Number(left.isDirectory) ||
        left.name.localeCompare(right.name),
    );
  }

  async readFile(serverId: string, relativePath: string) {
    const { target } = this.resolvePath(serverId, relativePath);
    const stats = await fs.stat(target);
    if (stats.size > maxTextReadBytes) {
      throw new Error("File too large to read in the panel");
    }
    return {
      path: relativePath,
      content: await fs.readFile(target, "utf8"),
      encoding: "utf8" as const,
    };
  }

  async writeFile(
    serverId: string,
    relativePath: string,
    content: string,
    encoding: "utf8" | "base64" = "utf8",
  ) {
    const { target } = this.resolvePath(serverId, relativePath);
    const buffer =
      encoding === "base64"
        ? Buffer.from(content, "base64")
        : Buffer.from(content, "utf8");
    await fs.outputFile(target, buffer);
    return { written: true, path: relativePath, size: buffer.byteLength };
  }

  createFileReadStream(serverId: string, relativePath: string) {
    const { target } = this.resolvePath(serverId, relativePath);
    return createReadStream(target);
  }

  async createFileWriteStream(serverId: string, relativePath: string) {
    const { target } = this.resolvePath(serverId, relativePath);
    await fs.ensureDir(path.dirname(target));
    return createWriteStream(target);
  }

  async deleteFile(serverId: string, relativePath: string) {
    const { target } = this.resolvePath(serverId, relativePath);
    await fs.remove(target);
    return { deleted: true, path: relativePath };
  }

  async makeDirectory(serverId: string, relativePath: string) {
    const { target } = this.resolvePath(serverId, relativePath);
    await fs.ensureDir(target);
    return { created: true, path: relativePath };
  }

  async moveFile(
    serverId: string,
    sourcePath: string,
    destinationPath: string,
  ) {
    const source = this.resolvePath(serverId, sourcePath).target;
    const destination = this.resolvePath(serverId, destinationPath).target;
    await fs.move(source, destination, { overwrite: true });
    return { moved: true };
  }

  async copyFile(
    serverId: string,
    sourcePath: string,
    destinationPath: string,
  ) {
    const source = this.resolvePath(serverId, sourcePath).target;
    const destination = this.resolvePath(serverId, destinationPath).target;
    await fs.copy(source, destination, { overwrite: true });
    return { copied: true };
  }

  async renameFile(serverId: string, sourcePath: string, newName: string) {
    const source = this.resolvePath(serverId, sourcePath);
    const destination = path.join(path.dirname(source.target), newName);
    if (!destination.startsWith(source.root)) {
      throw new Error("Refusing to rename outside server root");
    }
    await fs.move(source.target, destination, { overwrite: true });
    return { renamed: true };
  }

  async archivePath(serverId: string, sourcePath: string, archivePath: string) {
    const source = this.resolvePath(serverId, sourcePath);
    const archive = this.resolvePath(serverId, archivePath);
    await fs.ensureDir(path.dirname(archive.target));
    await tar.create(
      {
        gzip: true,
        file: archive.target,
        cwd: path.dirname(source.target),
      },
      [path.basename(source.target)],
    );
    return { archived: true, path: archivePath };
  }

  async extractArchive(
    serverId: string,
    archivePath: string,
    destinationPath: string,
  ) {
    const archive = this.resolvePath(serverId, archivePath);
    const destination = this.resolvePath(serverId, destinationPath);
    await fs.ensureDir(destination.target);
    await tar.extract({
      file: archive.target,
      cwd: destination.target,
    });
    return { extracted: true, path: destinationPath };
  }

  async cleanupFiles(
    serverId: string,
    relativePath: string,
    olderThanDays: number,
  ) {
    const { target } = this.resolvePath(serverId, relativePath);
    const entries = await fs.readdir(target);
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const entry of entries) {
      const fullPath = path.join(target, entry);
      const stats = await fs.stat(fullPath);
      if (stats.mtime.getTime() < cutoff) {
        await fs.remove(fullPath);
        deleted += 1;
      }
    }
    return { deleted };
  }

  async createBackup(serverId: string, backupId: string, backupName: string) {
    const serverRoot = this.getServerRoot(serverId);
    const backupRoot = this.getBackupRoot(serverId);
    await fs.ensureDir(backupRoot);
    const fileName = `${backupName.replace(/[^\w.-]+/g, "_")}-${backupId}.tar.gz`;
    const filePath = path.join(backupRoot, fileName);
    await tar.create(
      {
        gzip: true,
        file: filePath,
        cwd: serverRoot,
      },
      ["."],
    );
    const stats = await fs.stat(filePath);
    return {
      fileName,
      filePath,
      sizeBytes: stats.size,
    };
  }

  async restoreBackup(serverId: string, filePath: string, overwrite: boolean) {
    const serverRoot = this.getServerRoot(serverId);
    if (overwrite) {
      const children = await fs.readdir(serverRoot);
      for (const child of children) {
        if (child === "server.json") {
          continue;
        }
        await fs.remove(path.join(serverRoot, child));
      }
    }
    await tar.extract({
      file: filePath,
      cwd: serverRoot,
    });
    return { restored: true };
  }

  async readBackup(serverId: string, filePath: string) {
    const { target } = this.resolvePath(
      serverId,
      path.basename(filePath),
      "backup",
    );
    const buffer = await fs.readFile(target);
    return {
      fileName: path.basename(target),
      contentBase64: buffer.toString("base64"),
      sizeBytes: buffer.byteLength,
    };
  }

  createBackupReadStream(serverId: string, filePath: string) {
    const { target } = this.resolvePath(
      serverId,
      path.basename(filePath),
      "backup",
    );
    return createReadStream(target);
  }

  async createBackupWriteStream(serverId: string, fileName: string) {
    const { target } = this.resolvePath(serverId, fileName, "backup");
    await fs.ensureDir(path.dirname(target));
    return createWriteStream(target);
  }

  async deleteBackup(serverId: string, filePath: string) {
    const { target } = this.resolvePath(
      serverId,
      path.basename(filePath),
      "backup",
    );
    await fs.remove(target);
    return { deleted: true };
  }

  async findBackupPath(serverId: string, backupId: string) {
    const backupRoot = this.getBackupRoot(serverId);
    const files = await fs.readdir(backupRoot);
    const match = files.find((file) => file.includes(backupId));
    if (!match) {
      throw new Error("Backup file not found");
    }
    return path.join(backupRoot, match);
  }
}
