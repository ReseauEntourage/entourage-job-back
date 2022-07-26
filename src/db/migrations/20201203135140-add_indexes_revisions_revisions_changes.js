export default {
  up: (queryInterface) => {
    return Promise.all([
      queryInterface.addIndex('Revisions', ['documentId']),
      queryInterface.addIndex('Revisions', ['model', 'documentId']),
      queryInterface.addIndex('Revisions', ['model']),
      queryInterface.addIndex('RevisionChanges', ['revisionId']),
      queryInterface.addIndex('RevisionChanges', ['path', 'revisionId']),
      queryInterface.addIndex('RevisionChanges', ['path']),
    ]);
  },

  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeIndex('Revisions', ['documentId']),
      queryInterface.removeIndex('Revisions', ['model', 'documentId']),
      queryInterface.removeIndex('Revisions', ['model']),
      queryInterface.removeIndex('RevisionChanges', ['revisionId']),
      queryInterface.removeIndex('RevisionChanges', ['path', 'revisionId']),
      queryInterface.removeIndex('RevisionChanges', ['path']),
    ]);
  },
};
