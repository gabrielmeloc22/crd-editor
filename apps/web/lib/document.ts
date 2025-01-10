type ValueOf<T> = T[keyof T];

type Id = `${string}:${number}`; // site:clock

type Node = {
  id: Id;
  value: string;
  parent: Id | null;
  side: ValueOf<typeof SIDE_ENUM> | null;
  deleted: boolean;
  leftChildren: Id[];
  rightChildren: Id[];
};

const SIDE_ENUM = {
  R: "R",
  L: "L",
};

const OPERATION_TYPE_ENUM = {
  INSERT: "INSERT",
  DELETE: "DELETE",
} as const;

type InsertOperation = {
  type: typeof OPERATION_TYPE_ENUM.INSERT;
  data: Pick<Node, "id" | "parent" | "value" | "side">;
};

type DeleteOperation = {
  type: typeof OPERATION_TYPE_ENUM.DELETE;
  data: {
    id: Id;
  };
};

export type Operation = InsertOperation | DeleteOperation;

type OnChangeFn = (text: () => string, operation: Operation) => void;

export class TextDocument {
  site: string;
  nodes: Map<Id, Node> = new Map<Id, Node>();

  root: Node;
  clock: number = 0;

  onChange: OnChangeFn;

  constructor(args: { site: string; onChange: OnChangeFn }) {
    this.site = args.site;
    this.onChange = args.onChange;

    const rootId: Id = "root:0";
    const root: Node = {
      id: rootId,
      deleted: false,
      leftChildren: [],
      rightChildren: [],
      value: "",
      parent: null,
      side: null,
    };
    this.root = root;

    this.nodes.set(rootId, root);
  }

  /**
   * inserts a character on the given index
   *
   * @param index
   * @param content
   */
  public insert(index: number, content: string): void {
    const left = this.getByIndex(index - 1);
    const right = this.getByIndex(index);

    const createNode = (args: { side: string; parent: Id }): Node => {
      const node = {
        id: this.createId(),
        deleted: false,
        leftChildren: [],
        rightChildren: [],
        value: content,
        side: args.side,
        parent: args.parent,
      };

      this.addNode(node);

      return node;
    };

    let node: Node;

    if (left?.rightChildren.length === 0) {
      node = createNode({ parent: left.id, side: SIDE_ENUM.R });
    } else {
      node = createNode({ parent: right?.id as Id, side: SIDE_ENUM.L });
    }

    // TODO: investigate why scope gets lost when passing this.getText directly
    this.onChange(() => this.getText(), {
      data: {
        id: node.id,
        parent: node.parent,
        value: node.value,
        side: node.side,
      },
      type: OPERATION_TYPE_ENUM.INSERT,
    });
  }

  /**
   * deletes a character at the given index
   *
   * @param index
   */
  public delete(index: number): void {
    const node = this.getByIndex(index);

    if (node) {
      node.deleted = true;

      // TODO: investigate why scope gets lost when passing this.getText directly
      this.onChange(() => this.getText(), {
        data: { id: node.id },
        type: OPERATION_TYPE_ENUM.DELETE,
      });
    }
  }

  public sync(op: Operation): void {
    switch (op.type) {
      case OPERATION_TYPE_ENUM.INSERT:
        this.syncInsert(op.data);

        break;
      case OPERATION_TYPE_ENUM.DELETE:
        this.syncDelete(op.data.id);

        break;
    }
  }

  /**
   * returns a string that represents this document
   *
   * @returns string
   */
  public getText(): string {
    return this.traverse(this.root).reduce((acc, curr) => acc + curr.value, "");
  }

  private syncDelete(id: Id): void {
    const node = this.nodes.get(id);

    if (node) {
      node.deleted = true;
    }
  }

  private syncInsert(data: InsertOperation["data"]): void {
    const node = {
      ...data,
      deleted: false,
      leftChildren: [],
      rightChildren: [],
    };

    this.addNode(node);
  }

  private traverse(node: Node): Node[] {
    const iter = this.inOrderWalker(node);

    const nodes: Node[] = [];

    for (const node of iter) {
      if (!node.deleted) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  private *inOrderWalker(node: Node = this.root): Generator<Node> {
    const stack: { node: Node; state: number }[] = [{ node, state: 0 }];

    while (stack.length > 0) {
      const current = stack[stack.length - 1];

      switch (current?.state) {
        case 0:
          current.state = 1;
          for (let i = current.node.leftChildren.length - 1; i >= 0; i--) {
            const child = current.node.leftChildren[i];
            const childNode = child ? this.getNode(child) : null;

            if (childNode) {
              stack.push({ node: childNode, state: 0 });
            }
          }
          break;

        case 1:
          current.state = 2;
          yield current.node;
          break;

        case 2:
          stack.pop();
          for (let i = current.node.rightChildren.length - 1; i >= 0; i--) {
            const child = current.node.rightChildren[i];
            const childNode = child ? this.getNode(child) : null;

            if (childNode) {
              stack.push({ node: childNode, state: 0 });
            }
          }
          break;
      }
    }
  }

  // private *inOrderWalker(node: Node = this.root): Generator<Node> {
  //   // First traverse left children
  //   for (const child of node.leftChildren) {
  //     const childNode = this.getNode(child);
  //     if (childNode) {
  //       yield* this.inOrderWalker(childNode);
  //     }
  //   }

  //   // Yield current node
  //   yield node;

  //   // Then traverse right children
  //   for (const child of node.rightChildren) {
  //     const childNode = this.getNode(child);
  //     if (childNode) {
  //       yield* this.inOrderWalker(childNode);
  //     }
  //   }
  // }

  private getNode(nodeId: Id): Node | null {
    return this.nodes.get(nodeId) || null;
  }

  private insertIntoSiblings(node: Node) {
    if (!node.parent) {
      return;
    }

    const parent = this.getNode(node.parent);

    const siblings =
      node.side === SIDE_ENUM.L ? parent?.leftChildren : parent?.rightChildren;

    if (!siblings) {
      return;
    }

    let index = 0;

    while (true) {
      if (index === siblings.length) {
        break;
      }

      const sibling = siblings[index] as Id;

      if (node.id < sibling) {
        break;
      }

      index++;
    }

    siblings?.splice(index, 0, node.id);
  }

  private addNode(node: Node): void {
    this.nodes.set(node.id, node);
    this.insertIntoSiblings(node);
  }

  private createId(): Id {
    return `${this.site}:${this.clock++}`;
  }

  private getByIndex(
    index: number,
    includeDeleted: boolean = false
  ): Node | null {
    const iter = this.inOrderWalker();

    let current: Node | null = null;
    let i = 0;

    while (i <= index) {
      const result = iter.next();

      if (result.done) {
        break;
      }

      if (!includeDeleted && result.value.deleted) {
        continue;
      }

      current = result.value;
      i++;
    }

    return current;
  }

  /**
   * renders the overlying tree structure as a string
   * @returns string
   */
  public __renderTree__(): string {
    if (!this.root) return "Tree is empty.";

    const buildTree = (
      node: Node | null
    ): [lines: string[], width: number, center: number] => {
      if (!node) return [[], 0, 0];

      const getChildTree = (
        childId: Id | undefined
      ): [string[], number, number] =>
        childId && this.nodes.has(childId)
          ? buildTree(this.nodes.get(childId) || null)
          : [[], 0, 0];

      // Safely retrieve left and right subtrees
      const [leftLines, leftWidth, leftCenter] = getChildTree(
        node.leftChildren[0]
      );
      const [rightLines, rightWidth, rightCenter] = getChildTree(
        node.rightChildren[0]
      );

      const label = node.value;
      const labelWidth = label.length;
      const totalWidth = leftWidth + labelWidth + rightWidth;
      const labelCenter = leftWidth + Math.floor(labelWidth / 2);

      // Build lines for the current node and branches
      const nodeLine = `${" ".repeat(leftWidth)}${label}${" ".repeat(rightWidth)}`;
      const branchLine = [
        leftWidth > 0 ? `${" ".repeat(leftCenter)}/` : "",
        " ".repeat(labelWidth),
        rightWidth > 0 ? `\\${" ".repeat(rightWidth - rightCenter - 1)}` : "",
      ].join("");

      // Merge left and right subtrees
      const maxLines = Math.max(leftLines.length, rightLines.length);
      const mergedLines = Array.from(
        { length: maxLines },
        (_, i) =>
          `${leftLines[i] || " ".repeat(leftWidth)}${" ".repeat(labelWidth)}${
            rightLines[i] || " ".repeat(rightWidth)
          }`
      );

      return [[nodeLine, branchLine, ...mergedLines], totalWidth, labelCenter];
    };

    const [lines] = buildTree(this.root);
    return lines.join("\n");
  }
}
