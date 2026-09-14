const HEADING_REGEX = /^(h[1-6])\.\s+(.*)$/

function textNode(text) {
    return {
        type: 'text',
        text
    };
}

function applyMark(nodes, type, innerNodes) {
    for (const node of innerNodes) {
        const marks = (node.marks || []).map((mark) => ({ ...mark }));
        marks.unshift({ type });
        nodes.push({ ...node, marks });
    }
}

function parseInline(text) {
    const nodes = [];
    const inlineRegex = /\[([^\]|]+)\|([^\]]+)\]|\*([^*]+)\*|_([^_]+)_/g;
    let lastIndex = 0;
    let match;

    while ((match = inlineRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(textNode(text.slice(lastIndex, match.index)));
        }

        if (match[1] !== undefined) {
            nodes.push({
                type: 'text',
                text: match[1],
                marks: [{
                    type: 'link',
                    attrs: {
                        href: match[2]
                    }
                }]
            });
        } else if (match[3] !== undefined) {
            applyMark(nodes, 'strong', parseInline(match[3]));
        } else if (match[4] !== undefined) {
            applyMark(nodes, 'em', parseInline(match[4]));
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        nodes.push(textNode(text.slice(lastIndex)));
    }

    return nodes;
}

function parseBlock(wikiBlock) {
    const lines = wikiBlock.split('\n').map((line) => line.trim())
    const blocks = []

    const headingMatch = HEADING_REGEX.exec(lines[0])
    if (headingMatch) {
        blocks.push({
            type: 'heading',
            attrs: {
                level: Number(headingMatch[1][1])
            },
            content: parseInline(headingMatch[2])
        })
        lines.shift()
    }

    for (const line of lines) {
        if (line) {
            blocks.push({
                type: 'paragraph',
                content: parseInline(line)
            })
        }
    }

    return blocks
}

function wikiToAdf(wikiMarkup) {
    const content = String(wikiMarkup || '')
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean)
        .flatMap(parseBlock)

    return {
        version: 1,
        type: 'doc',
        content
    }
}

function renderInline(nodes) {
    return (nodes || []).map((node) => {
        if (node.type === 'hardBreak') {
            return '\n'
        }

        if (node.type === 'mention') {
            return node.attrs && node.attrs.text || ''
        }

        if (node.type === 'emoji') {
            return node.attrs && node.attrs.shortName || ''
        }

        const marks = node.marks || []
        const link = marks.find((mark) => mark.type === 'link')
        const strong = marks.some((mark) => mark.type === 'strong')
        const em = marks.some((mark) => mark.type === 'em')

        let text = node.text || renderInline(node.content)

        if (link) {
            text = `[${text}|${link.attrs.href}]`
        }
        if (strong) {
            text = `*${text}*`
        }
        if (em) {
            text = `_${text}_`
        }

        return text
    }).join('')
}

function renderBlock(node) {
    switch (node.type) {
        case 'heading':
            return `h${node.attrs.level}. ${renderInline(node.content)}`
        case 'paragraph':
            return renderInline(node.content)
        case 'codeBlock':
            return `{code}\n${(node.content || []).map((line) => line.text).join('\n')}\n{code}`
        case 'bulletList':
            return node.content.map((item) => `* ${renderBlock(item.content[0])}`).join('\n')
        case 'orderedList':
            return node.content.map((item, index) => `# ${renderBlock(item.content[0])}`).join('\n')
        case 'rule':
            return '----'
        default:
            return renderInline(node.content)
    }
}

function adfToText(document) {
    if (!document) {
        return ''
    }

    if (typeof document === 'string') {
        return document
    }

    return (document.content || []).map(renderBlock).join('\n')
}

module.exports.wikiToAdf = wikiToAdf
module.exports.adfToText = adfToText