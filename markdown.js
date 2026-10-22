// Markdown mínimo para respostas curtas: títulos, listas, código, tabela,
// citação, negrito/itálico. Tolera texto incompleto durante o streaming.
;(() => {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  function inline(raw) {
    return raw
      .split(/(`[^`]+`)/g)
      .map((part) => {
        if (/^`[^`]+`$/.test(part)) return `<code>${esc(part.slice(1, -1))}</code>`
        return esc(part)
          .replace(/\*\*(?=\S)(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/(^|[^\w*])\*(?=\S)([^*]+?)\*(?![\w*])/g, '$1<em>$2</em>')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '<span class="link">$1</span>')
      })
      .join('')
  }

  const isFence = (l) => /^\s*```/.test(l)
  const isBullet = (l) => /^\s*[-*•]\s+/.test(l)
  const isNumbered = (l) => /^\s*\d+[.)]\s+/.test(l)
  const isHeading = (l) => /^#{1,4}\s+/.test(l)
  const isQuote = (l) => /^>\s?/.test(l)
  const isRule = (l) => /^\s*([-*_━─])(\s*\1){2,}\s*$/.test(l)
  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l)
  const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l)
  const startsBlock = (l) =>
    isFence(l) || isBullet(l) || isNumbered(l) || isHeading(l) || isQuote(l) || isRule(l) || isTableRow(l)
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

  function render(src) {
    const lines = src.split('\n')
    let html = ''
    let i = 0
    while (i < lines.length) {
      const line = lines[i]

      if (isFence(line)) {
        const lang = line.trim().slice(3).trim()
        const buf = []
        i++
        // bloco ainda aberto no streaming → vai até o fim do texto
        while (i < lines.length && !isFence(lines[i])) buf.push(lines[i++])
        i++
        const tag = lang ? `<span class="lang">${esc(lang)}</span>` : ''
        html += `<pre>${tag}<code>${esc(buf.join('\n'))}</code></pre>`
        continue
      }

      if (!line.trim()) { i++; continue }

      if (isHeading(line)) {
        const n = line.match(/^#+/)[0].length
        html += `<h${n}>${inline(line.replace(/^#+\s+/, ''))}</h${n}>`
        i++
        continue
      }

      if (isRule(line)) { html += '<hr>'; i++; continue }

      if (isQuote(line)) {
        const buf = []
        while (i < lines.length && isQuote(lines[i])) buf.push(inline(lines[i++].replace(/^>\s?/, '')))
        html += `<blockquote>${buf.join('<br>')}</blockquote>`
        continue
      }

      if (isBullet(line) || isNumbered(line)) {
        const ordered = isNumbered(line)
        const test = ordered ? isNumbered : isBullet
        const items = []
        while (i < lines.length && test(lines[i])) {
          let item = lines[i++].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
          // continuação da linha do item (indentada, sem marcador)
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !startsBlock(lines[i])) item += ' ' + lines[i++].trim()
          items.push(`<li>${inline(item)}</li>`)
        }
        const start = ordered ? parseInt(line.trim(), 10) : 1
        html += ordered
          ? `<ol${start !== 1 ? ` start="${start}"` : ''}>${items.join('')}</ol>`
          : `<ul>${items.join('')}</ul>`
        continue
      }

      if (isTableRow(line)) {
        const rows = []
        while (i < lines.length && isTableRow(lines[i])) rows.push(lines[i++])
        let head = ''
        if (rows.length > 1 && isTableSep(rows[1])) {
          head = `<thead><tr>${cells(rows[0]).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
          rows.splice(0, 2)
        }
        const body = rows
          .filter((r) => !isTableSep(r))
          .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')
        html += `<table>${head}<tbody>${body}</tbody></table>`
        continue
      }

      const buf = []
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) buf.push(inline(lines[i++]))
      html += `<p>${buf.join('<br>')}</p>`
    }
    return html
  }

  window.renderMarkdown = render
})()
