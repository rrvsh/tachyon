import { describe, expect, it } from "vitest";
import type { MessageRecord } from "../../src/data/schema";
import {
  editInPlace,
  editWithSubtree,
  regenerateAssistant,
} from "../../src/messages/operations";
import {
  latestDescendant,
  latestLeaf,
  pathToMessage,
  siblings,
} from "../../src/messages/tree";

const m = (
  id: string,
  parentId: string | null,
  createdAt: number,
): MessageRecord => ({
  id,
  sessionId: "s",
  role: id.startsWith("u") ? "user" : "assistant",
  content: id,
  parentId,
  createdAt,
  updatedAt: createdAt,
  finalized: true,
});

describe("message tree", () => {
  const messages = [
    m("u1", null, 1),
    m("a1", "u1", 2),
    m("u2", "a1", 3),
    m("a2", "u2", 4),
    m("a3", "u2", 5),
    m("u3", "a2", 6),
    m("a4", "u3", 7),
    m("a5", "u3", 8),
    m("uRoot", null, 9),
  ];
  it("builds visible paths", () =>
    expect(pathToMessage(messages, "a3").map((x) => x.id)).toEqual([
      "u1",
      "a1",
      "u2",
      "a3",
    ]));
  it("finds latest leaf by created time then id", () =>
    expect(latestLeaf(messages, "s")?.id).toBe("uRoot"));
  it("orders siblings", () =>
    expect(siblings(messages, messages[3]).map((x) => x.id)).toEqual([
      "a2",
      "a3",
    ]));
  it("selects latest descendant for branch switching", () =>
    expect(latestDescendant(messages, messages[0]).id).toBe("a5"));

  it("edit in place creates a sibling branch with copied continuation", () => {
    const result = editInPlace(messages, "a2", "u2", "edited");
    expect(result.newMessages).toHaveLength(2);
    expect(result.newMessages[0]).toMatchObject({
      content: "edited",
      parentId: "a1",
    });
    expect(result.newMessages[1].parentId).toBe(result.newMessages[0].id);
  });

  it("save edit clones the following subtree including descendant variants", () => {
    const result = editWithSubtree(messages, "a4", "u2", "edited");
    expect(result.newMessages).toHaveLength(6);
    const edited = result.newMessages[0];
    expect(edited).toMatchObject({ content: "edited", parentId: "a1" });
    const clonedU3 = result.newMessages.find((x) => x.content === "u3")!;
    expect(clonedU3.parentId).toBe(
      result.newMessages.find((x) => x.content === "a2")!.id,
    );
    expect(
      result.newMessages.filter((x) => x.content.startsWith("a")),
    ).toHaveLength(4);
    expect(result.selectedId).toBe(
      result.newMessages.find((x) => x.content === "a4")!.id,
    );
  });

  it("save and resend edit only creates the edited sibling", () => {
    const result = editWithSubtree(messages, "a4", "u2", "edited", false);
    expect(result.newMessages).toHaveLength(1);
    expect(result.newMessages[0]).toMatchObject({
      content: "edited",
      parentId: "a1",
    });
    expect(result.selectedId).toBe(result.newMessages[0].id);
  });

  it("regenerate creates an assistant sibling from the same parent", () => {
    const regen = regenerateAssistant(messages[3]);
    expect(regen).toMatchObject({
      role: "assistant",
      parentId: "u2",
      finalized: false,
    });
  });
});
