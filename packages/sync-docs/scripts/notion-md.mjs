// Minimal Notion recordMap -> Markdown converter for PUBLIC pages
// (fed by notion-client's NotionAPI.getPage, no token required).
//
// Scope is deliberately narrow: the block types the planning docs in
// .claude/docs actually use. Unknown blocks degrade to their plain text
// instead of throwing.

const unwrap = (r) => r?.value?.value ?? r?.value ?? r;

// Notion rich-text array -> markdown inline string.
function rich(arr) {
  if (!Array.isArray(arr)) return "";
  return arr
    .map(([text, fmts]) => {
      let s = text ?? "";
      if (Array.isArray(fmts)) {
        for (const f of fmts) {
          switch (f[0]) {
            case "b": s = `**${s}**`; break;
            case "i": s = `*${s}*`; break;
            case "s": s = `~~${s}~~`; break;
            case "c": s = `\`${s}\``; break;
            case "a": s = `[${s}](${f[1]})`; break;
            default: break; // color/equation/etc. -> plain
          }
        }
      }
      return s;
    })
    .join("");
}

const title = (b) => rich(b?.properties?.title);

export function recordMapToMarkdown(recordMap, rootId) {
  const blocks = recordMap.block || {};
  const get = (id) => unwrap(blocks[id]);
  const out = [];

  const pushBlank = () => {
    if (out.length && out[out.length - 1] !== "") out.push("");
  };

  function renderChildren(ids, indent) {
    let numbered = 0;
    for (const id of ids || []) {
      const b = get(id);
      if (!b) continue;
      if (b.type === "numbered_list") numbered += 1;
      else numbered = 0;
      renderBlock(b, indent, numbered);
    }
  }

  function renderBlock(b, indent, numbered) {
    const pad = "    ".repeat(indent);
    switch (b.type) {
      case "page":
        renderChildren(b.content, indent);
        break;
      case "header":
        pushBlank();
        out.push(`# ${title(b)}`);
        pushBlank();
        break;
      case "sub_header":
        pushBlank();
        out.push(`## ${title(b)}`);
        pushBlank();
        break;
      case "sub_sub_header":
        pushBlank();
        out.push(`### ${title(b)}`);
        pushBlank();
        break;
      case "text": {
        const t = title(b);
        if (t) {
          out.push(`${pad}${t}`);
          pushBlank(); // paragraphs are blank-line separated
        } else {
          pushBlank();
        }
        break;
      }
      case "bulleted_list":
        out.push(`${pad}- ${title(b)}`);
        renderChildren(b.content, indent + 1);
        break;
      case "numbered_list":
        out.push(`${pad}${numbered || 1}. ${title(b)}`);
        renderChildren(b.content, indent + 1);
        break;
      case "to_do":
        out.push(
          `${pad}- [${b.properties?.checked?.[0]?.[0] === "Yes" ? "x" : " "}] ${title(b)}`
        );
        renderChildren(b.content, indent + 1);
        break;
      case "toggle":
        out.push(`${pad}- ${title(b)}`);
        renderChildren(b.content, indent + 1);
        break;
      case "quote":
        out.push(`${pad}> ${title(b)}`);
        break;
      case "callout": {
        const icon = b.format?.page_icon || "";
        pushBlank();
        out.push("<aside>");
        if (icon) {
          out.push(icon);
          out.push("");
        }
        const t = title(b);
        if (t) out.push(t);
        renderChildren(b.content, 0);
        out.push("</aside>");
        pushBlank();
        break;
      }
      case "code":
        pushBlank();
        out.push("```" + (b.properties?.language?.[0]?.[0] || "").toLowerCase());
        out.push(title(b));
        out.push("```");
        pushBlank();
        break;
      case "divider":
        pushBlank();
        out.push("---");
        pushBlank();
        break;
      case "image": {
        const src = b.format?.display_source || b.properties?.source?.[0]?.[0];
        if (src) out.push(`![](${src})`);
        break;
      }
      case "column_list":
      case "column":
        renderChildren(b.content, indent);
        break;
      case "collection_view":
      case "collection_view_page":
        break; // embedded sub-database: not part of the spec text
      default: {
        const t = title(b);
        if (t) out.push(`${pad}${t}`);
        renderChildren(b.content, indent);
      }
    }
  }

  const root = get(rootId) || get(Object.keys(blocks)[0]);
  if (!root) throw new Error("root block not found in recordMap");
  renderBlock(root, 0, 0);

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
