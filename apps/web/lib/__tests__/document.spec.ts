import { expect, it, vi } from "vitest";
import { TextDocument } from "../document";

it("should be able to insert characters from left to right", () => {
  let text = "";

  const document = new TextDocument({
    site: "site",
    onChange: (t) => {
      text = t();
    },
  });

  document.insert(0, "h");
  document.insert(1, "e");
  document.insert(2, "l");
  document.insert(3, "l");
  document.insert(4, "o");

  expect(text).toBe("hello");
});

it("should be able to insert characters in the middle", () => {
  let text = "";

  const document = new TextDocument({
    site: "site",
    onChange: (t) => {
      text = t();
    },
  });

  document.insert(0, "h");
  document.insert(1, "e");
  document.insert(2, "l");
  document.insert(3, "l");
  document.insert(4, "o");

  document.insert(4, "c");
  document.insert(3, "d");

  expect(text).toBe("heldlco");
});

it("should be able to insert characters from right to left", () => {
  let text = "";

  const document = new TextDocument({
    site: "site",
    onChange: (t) => {
      text = t();
    },
  });

  document.insert(0, "o");
  document.insert(0, "l");
  document.insert(0, "l");
  document.insert(0, "e");
  document.insert(0, "h");

  expect(text).toBe("hello");
});

it("should be able to delete a character", () => {
  let text = "";

  const document = new TextDocument({
    site: "site",
    onChange: (t) => {
      text = t();
    },
  });

  document.insert(0, "h");
  document.insert(1, "e");
  document.insert(2, "l");
  document.insert(3, "l");
  document.insert(4, "o");

  document.delete(2);
  document.delete(2);

  expect(text).toBe("heo");
});

it("should be able to insert after a deleted character", () => {
  let text = "";

  const document = new TextDocument({
    site: "site",
    onChange: (t) => {
      text = t();
    },
  });

  document.insert(0, "e");
  document.insert(1, "h");
  document.insert(2, "l");
  document.insert(3, "l");
  document.insert(4, "o");

  document.delete(0);
  document.delete(0);
  document.insert(0, "h");
  document.insert(1, "e");

  expect(text).toBe("hello");
});

it("should be able to insert before a deleted character", () => {
  let text = "";

  const document = new TextDocument({
    site: "site",
    onChange: (t) => {
      text = t();
    },
  });

  document.insert(0, "h");
  document.insert(1, "e");
  document.insert(2, "l");
  document.insert(3, "l");
  document.insert(4, "o");

  document.delete(2);
  document.insert(1, "e");
  document.insert(1, "e");

  expect(text).toBe("heeelo");
});

it("should concurrently write and eventually converge to the same state", async () => {
  const docA = new TextDocument({ site: "docA", onChange: () => {} });

  const docB = new TextDocument({ site: "docB", onChange: () => {} });

  docA.onChange = (_, op) => {
    setTimeout(() => {
      docB.sync(op);
    }, 20);
  };

  docB.onChange = (_, op) => {
    setTimeout(() => {
      docA.sync(op);
    }, 20);
  };

  const writeA = new Promise((res) => {
    docA.insert(0, "a");
    docA.insert(1, "b");

    res(true);
  });

  const writeB = new Promise((res) => {
    docB.insert(0, "c");
    docB.insert(1, "d");

    res(true);
  });

  await Promise.all([writeA, writeB]);

  // wait til it causally converges
  await vi.waitFor(async () => {
    const textA = docA.getText();
    const textB = docB.getText();

    expect(textA).toBeTruthy();
    expect(textB).toBeTruthy();

    expect(textA).toBe("abcd");
    expect(textA).toEqual(textB);
  });
});
