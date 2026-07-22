import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDbForTests, putOne, snapshot } from "../../src/data/db";
import {
  analyzeImport,
  createExport,
  importFile,
} from "../../src/data/importExport";
import type { MessageRecord, SessionRecord } from "../../src/data/schema";

describe("import/export", () => {
  beforeEach(async () => clearDbForTests());
  it("exports canonical records without local settings", async () => {
    const s: SessionRecord = {
      id: "abcdefgh",
      title: "t",
      createdAt: 1,
      updatedAt: 1,
      archived: false,
      rootMessageId: null,
    };
    await putOne("sessions", s);
    expect(await createExport()).toMatchObject({
      version: 1,
      sessions: [s],
      messages: [],
      agents: [],
    });
  });
  it("merges records that differ only by updatedAt", async () => {
    const s: SessionRecord = {
      id: "updonly1",
      title: "same",
      createdAt: 1,
      updatedAt: 2,
      archived: false,
      rootMessageId: null,
    };
    await putOne("sessions", s);
    await importFile({
      version: 1,
      exportedAt: 4,
      sessions: [{ ...s, updatedAt: 3 }],
      messages: [],
      agents: [],
    });
    const snap = await snapshot();
    expect(snap.sessions[0]).toMatchObject({ title: "same", updatedAt: 3 });
    expect(snap.quarantined).toHaveLength(0);
  });

  it("merges archive status using the newer metadata timestamp", async () => {
    const s: SessionRecord = {
      id: "archive1",
      title: "same",
      createdAt: 1,
      updatedAt: 2,
      archived: false,
      rootMessageId: null,
    };
    await putOne("sessions", s);
    await importFile({
      version: 1,
      exportedAt: 4,
      sessions: [{ ...s, archived: true, updatedAt: 3 }],
      messages: [],
      agents: [],
    });
    const snap = await snapshot();
    expect(snap.sessions[0]).toMatchObject({ archived: true, updatedAt: 3 });
    expect(snap.quarantined).toHaveLength(0);
  });

  it("reports field-level conflict diffs for stable-ID conflicts", async () => {
    const s: SessionRecord = {
      id: "abcdefgh",
      title: "a",
      createdAt: 1,
      updatedAt: 2,
      archived: false,
      rootMessageId: null,
    };
    await putOne("sessions", s);
    const review = await analyzeImport({
      version: 1,
      exportedAt: 3,
      sessions: [{ ...s, title: "b", updatedAt: 3 }],
      messages: [],
      agents: [],
    });
    expect(review.summary?.sessions.quarantined).toBe(1);
    expect(review.records?.sessions[0]).toMatchObject({
      id: "abcdefgh",
      status: "conflict",
      label: "b",
      reason: "Conflicting stable ID record",
    });
    expect(review.records?.sessions[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "title", local: "a", incoming: "b" }),
      ]),
    );
  });

  it("quarantines stable-ID conflicts instead of overwriting newer incoming records", async () => {
    const s: SessionRecord = {
      id: "abcdefgh",
      title: "a",
      createdAt: 1,
      updatedAt: 2,
      archived: false,
      rootMessageId: null,
    };
    await putOne("sessions", s);
    await importFile({
      version: 1,
      exportedAt: 3,
      sessions: [{ ...s, title: "b", updatedAt: 3 }],
      messages: [],
      agents: [],
    });
    const snap = await snapshot();
    expect(snap.sessions[0].title).toBe("a");
    expect(snap.quarantined).toHaveLength(1);
  });

  it("applies explicit incoming conflict resolutions during merge", async () => {
    const s: SessionRecord = {
      id: "abcdefgh",
      title: "a",
      createdAt: 1,
      updatedAt: 2,
      archived: false,
      rootMessageId: null,
    };
    await putOne("sessions", s);
    await importFile(
      {
        version: 1,
        exportedAt: 3,
        sessions: [{ ...s, title: "b", updatedAt: 3 }],
        messages: [],
        agents: [],
      },
      { "sessions:abcdefgh": "incoming" },
    );
    const snap = await snapshot();
    expect(snap.sessions[0].title).toBe("b");
    expect(snap.quarantined).toHaveLength(0);
  });

  it("skips broken references when explicitly resolved to skip", async () => {
    const session: SessionRecord = {
      id: "imports1",
      title: "bad refs",
      createdAt: 1,
      updatedAt: 1,
      archived: false,
      rootMessageId: "notroot",
    };
    await importFile(
      {
        version: 1,
        exportedAt: 3,
        sessions: [session],
        messages: [],
        agents: [],
      },
      { "sessions:imports1": "skip" },
    );
    const snap = await snapshot();
    expect(snap.sessions).toHaveLength(0);
    expect(snap.quarantined).toHaveLength(0);
  });

  it("quarantines broken session root and message parent references", async () => {
    const session: SessionRecord = {
      id: "imports1",
      title: "bad refs",
      createdAt: 1,
      updatedAt: 1,
      archived: false,
      rootMessageId: "notroot",
    };
    const message: MessageRecord = {
      id: "notroot",
      sessionId: session.id,
      role: "assistant",
      content: "bad root",
      parentId: "missing-parent",
      createdAt: 2,
      updatedAt: 2,
      finalized: true,
    };
    await importFile({
      version: 1,
      exportedAt: 3,
      sessions: [session],
      messages: [message],
      agents: [],
    });
    const snap = await snapshot();
    expect(snap.sessions).toHaveLength(0);
    expect(snap.messages).toHaveLength(0);
    expect(snap.quarantined).toHaveLength(2);
  });
});
