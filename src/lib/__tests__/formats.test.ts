import { describe, expect, it } from "vitest";
import { durationMsFromProbe } from "../backend";
import { kindOf, targetById, targetsFor } from "../formats";

describe("kindOf", () => {
  it("classifica por extensão; gif conta como vídeo (animado)", () => {
    expect(kindOf("C:/x/a.mp4")).toBe("video");
    expect(kindOf("C:/x/a.GIF")).toBe("video");
    expect(kindOf("C:/x/song.flac")).toBe("audio");
    expect(kindOf("C:/x/foto.JPEG")).toBe("image");
    expect(kindOf("C:/x/doc.docx")).toBe(null);
  });
});

describe("targetsFor", () => {
  it("vídeo oferece mp4/webm/mkv + extrair áudio, sem o formato que já é", () => {
    const ids = targetsFor("C:/x/a.webm")!.map((t) => t.id);
    expect(ids).toContain("mp4");
    expect(ids).toContain("mp3");
    expect(ids).not.toContain("webm"); // já é webm
  });

  it("áudio oferece os codecs de áudio, sem o próprio", () => {
    const ids = targetsFor("C:/x/a.mp3")!.map((t) => t.id);
    expect(ids).toContain("flac");
    expect(ids).toContain("wav");
    expect(ids).not.toContain("mp3");
  });

  it("imagem: jpg não aparece pra um .jpeg (mesmo formato)", () => {
    const ids = targetsFor("C:/x/foto.jpeg")!.map((t) => t.id);
    expect(ids).not.toContain("jpg");
    expect(ids).toContain("png");
    expect(ids).toContain("webp");
  });

  it("formato desconhecido → null (documento, por ora)", () => {
    expect(targetsFor("C:/x/rel.docx")).toBe(null);
  });
});

describe("args do alvo (o input é -i, a saída é o último)", () => {
  it("mp4 tem H.264 + faststart", () => {
    const a = targetById("C:/x/a.avi", "mp4")!.args("C:/x/a.avi", "C:/x/a.mp4");
    expect(a[0]).toBe("-i");
    expect(a[1]).toBe("C:/x/a.avi");
    expect(a[a.length - 1]).toBe("C:/x/a.mp4");
    expect(a).toContain("libx264");
    expect(a).toContain("+faststart");
  });

  it("extrair áudio de vídeo usa -vn", () => {
    const a = targetById("C:/x/a.mp4", "mp3")!.args("C:/x/a.mp4", "C:/x/a.mp3");
    expect(a).toContain("-vn");
    expect(a).toContain("libmp3lame");
  });
});

describe("durationMsFromProbe", () => {
  it("lê format.duration em segundos → ms", () => {
    expect(durationMsFromProbe('{"format":{"duration":"12.500"}}')).toBe(12500);
  });
  it("imagem/sem duração → 0, e json inválido não explode", () => {
    expect(durationMsFromProbe('{"format":{}}')).toBe(0);
    expect(durationMsFromProbe("nao é json")).toBe(0);
  });
});
