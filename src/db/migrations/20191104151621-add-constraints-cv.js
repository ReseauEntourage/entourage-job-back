module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addConstraint('CV_Ambitions', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Ambitions_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'cascade',
          onUpdate: 'cascade',
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Contracts', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Contracts_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'cascade',
          onUpdate: 'cascade',
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Languages', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Languages_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'cascade',
          onUpdate: 'cascade',
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Passions', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Passions_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'cascade',
          onUpdate: 'cascade',
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Skills', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Skills_CVId_fkey',
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
        queryInterface.removeConstraint(
          'CV_Ambitions',
          'CV_Ambitions_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'CV_Contracts',
          'CV_Contracts_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'CV_Languages',
          'CV_Languages_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'CV_Passions',
          'CV_Passions_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint('CV_Skills', 'CV_Skills_CVId_fkey', {
          transaction: t,
        }),
      ]);
    });
  },
};
