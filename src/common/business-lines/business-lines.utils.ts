function addSpaceToPrefixIfNeeded(prefix: string) {
  if (!prefix) {
    return '';
  }
  return prefix.includes("'") ? prefix : `${prefix} `;
}

export function buildBusinessLineForSentence({
  label,
  prefix,
}: {
  label: string;
  prefix?: string | string[];
}) {
  const separator = 'et ';
  if (Array.isArray(prefix)) {
    let mutatedLabel = '';
    const splittedLabel = label.split(separator);
    for (let i = 1; i < splittedLabel.length; i += 1) {
      mutatedLabel +=
        separator + addSpaceToPrefixIfNeeded(prefix[i]) + splittedLabel[i];
    }
    return (
      addSpaceToPrefixIfNeeded(prefix[0]) + splittedLabel[0] + mutatedLabel
    );
  }
  return addSpaceToPrefixIfNeeded(prefix) + label;
}
