"use client";

import { useEffect, useRef, useState } from "react";
import { v4 } from "uuid";
import { Operation, TextDocument } from "../lib/document";
import { socket } from "../lib/ws";

export default function Home() {
  const [text, setText] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const docRef = useRef(
    new TextDocument({
      site: v4(),
      onChange: (text, op) => {
        setText(text());
        socket.send(JSON.stringify(op));
      },
    })
  );

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;

    const onMessage = function (msg: MessageEvent<string>) {
      const operation = JSON.parse(msg.data) as Operation;

      docRef.current.sync(operation);

      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        setText(docRef.current.getText());
      }, 50);
    };

    socket.addEventListener("message", onMessage);

    return () => {
      socket.removeEventListener("message", onMessage);
    };
  }, []);

  const handleOnInsert = (args: {
    selectionStart: number;
    selectionEnd: number;
    value: string;
    set?: boolean;
  }) => {
    const selectionStart = args.selectionStart - 1;
    const selectionEnd = args.selectionEnd;

    const newChars = args.set
      ? args.value
      : args.value.slice(selectionStart, selectionEnd);

    if (selectionStart === 0) {
      docRef.current.insert(0, newChars);
      return;
    }

    docRef.current.insert(selectionStart, newChars);
  };

  const handleOnDelete = (args: {
    selectionStart: number;
    value: string;
    selectionEnd: number;
  }) => {
    const selectionStart = args.selectionStart;

    docRef.current.delete(selectionStart);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-10 bg-white-200 px-4 py-8">
      <textarea
        placeholder="Type something nice :)"
        ref={textAreaRef}
        value={text}
        className="flex-grow max-w-[100ch] w-full resize-none ing-0 outline-none p-12 shadow-blue-200 shadow-2xl rounded-md border border-slate-200"
        onInput={(e) => {
          const value = e.currentTarget.value;

          const isDelete = text.length - value.length > 0;

          if (isDelete) {
            handleOnDelete({
              selectionStart: e.currentTarget.selectionStart,
              selectionEnd: e.currentTarget.selectionEnd,
              value: e.currentTarget.value,
            });

            return;
          }

          handleOnInsert({
            selectionStart: e.currentTarget.selectionStart,
            selectionEnd: e.currentTarget.selectionEnd,
            value: e.currentTarget.value,
          });
        }}
        onKeyDown={async (e) => {
          if (e.ctrlKey && e.key === "v") {
            handleOnInsert({
              selectionStart: textAreaRef.current?.selectionStart || 0,
              selectionEnd: textAreaRef.current?.selectionEnd || 0,
              value: await navigator.clipboard.readText(),
              set: true,
            });
            return;
          }
        }}
      />
    </div>
  );
}
