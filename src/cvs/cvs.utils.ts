export function getPDFPaths(candidateId: string, queryFileName: string) {
  const fileName = queryFileName
    ? `${queryFileName}_${candidateId.substring(0, 8)}`
    : candidateId;

  return [
    `${candidateId}-page1.pdf`,
    `${candidateId}-page2.pdf`,
    `${fileName.replace(/'/g, '')}.pdf`,
  ];
}
