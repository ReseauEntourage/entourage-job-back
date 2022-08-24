module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeConstraint('Reviews', 'Reviews_CVId_fkey', {
          transaction: t,
        }),
        queryInterface.addConstraint('Reviews', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'Reviews_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'cascade',
          onUpdate: 'cascade',
          transaction: t,
        }),
      ]);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeConstraint('Reviews', 'Reviews_CVId_fkey', {
          transaction: t,
        }),
        queryInterface.addConstraint('Reviews', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'Reviews_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          transaction: t,
        }),
      ]);
    });
  },
};
