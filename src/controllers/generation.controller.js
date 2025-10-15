const path = require('path');
const parser = require('../modules/input_parser');
const generator = require('../modules/code_generator');
const packager = require('../modules/project_packager');
const logger = require('../utils/logger').logger;
const config = require('../config');

async function generateProject(req, res, next) {
  try {
    const { description, projectName } = req.body;
  const parsed = await parser.parseInput(description);

  // early guard: only mongodb supported
  if (parsed.database && String(parsed.database).toLowerCase() !== 'mongodb') {
    const { HttpError } = require('../utils/httpError');
    throw new HttpError(422, 'Only MongoDB is supported in this version');
  }

  const projectNameSafe = projectName || (parsed.projectType || 'project') + '-' + Date.now();

  // include original description in parsed intent so templates can reference it
  const parsedWithDesc = { ...parsed, description };

  const genResult = await generator.generateCode(parsedWithDesc, { projectName: projectNameSafe });

    const packageResult = await packager.packageProject(genResult.projectPath, projectNameSafe);

    res.json({
      success: true,
      files: genResult.fileList.map(p => path.relative(process.cwd(), p)),
      zip: {
        name: packageResult.zipName,
        url: `/downloads/${packageResult.zipName}`
      }
    });
  } catch (err) {
    logger.error(err);
    next(err);
  }
}

module.exports = { generateProject };
