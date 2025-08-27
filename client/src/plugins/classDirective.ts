// client/src/plugins/classDirective.ts
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root } from 'mdast';

export const classDirective: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree as any, (node: any) => {
    if (node.type === 'textDirective' || node.type === 'leafDirective' || node.type === 'containerDirective') {
      if (node.name) {
        const data = (node.data ??= {});
        data.hName = node.type === 'textDirective' ? 'span' : 'div';
        data.hProperties = { className: `${node.name}-text` };
      }
    }
  });
};