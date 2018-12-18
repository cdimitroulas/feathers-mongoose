const errors = require('@feathersjs/errors');

// This check may not work with field names container underscores and numbers (e.g. address_1)
function isCompoundIndexError (error) {
  return /^.*collection:.*index:\s\w*_\d_\w*_\d\s*dup key/i.test(error.message);
}

module.exports = function errorHandler (error) {
  if (error.code === 11000 || error.code === 11001) {
    // NOTE: In order to handle this correctly it is necessary to query the collections indexes
    // to understand the field names - this is how mongoose-beautiful-unique-validation library
    // achieves this
    // https://github.com/matteodelabre/mongoose-beautiful-unique-validation/blob/master/index.js#L123
    if (isCompoundIndexError(error)) {
      const keyMatch = error.message.match(/index:\s(\w*)_\d_(\w*)_\d\s*dup key/i);
      const valueMatch = error.message.match(/\s*dup key:\s*\{\s*:\s*"(.*)",\s*:\s*"(.*)"\s*\}/i);

      const keys = [keyMatch[1], keyMatch[2]];
      const values = [valueMatch[1], valueMatch[2]];

      error.message = `{ ${keys[0]}: ${values[0]}, ${keys[1]}: ${values[1]} } already exists.`;
      error.errors = { [keys[0]]: values[0], [keys[1]]: values[1] };
      return Promise.reject(new errors.Conflict(error));
    }

    // NOTE (EK): Error parsing as discussed in this github thread
    // https://github.com/Automattic/mongoose/issues/2129
    const match1 = error.message.match(/_?([a-zA-Z]*)_?\d?\s*dup key/i);
    const match2 = error.message.match(/\s*dup key:\s*\{\s*:\s*"?(.*?)"?\s*\}/i);

    const key = match1 ? match1[1] : 'path';
    let value = match2 ? match2[1] : 'value';

    if (value === 'null') {
      value = null;
    } else if (value === 'undefined') {
      value = undefined;
    }

    error.message = `${key}: ${value} already exists.`;
    error.errors = {
      [key]: value
    };

    return Promise.reject(new errors.Conflict(error));
  }

  if (error.name) {
    switch (error.name) {
      case 'ValidationError':
      case 'ValidatorError':
      case 'CastError':
      case 'VersionError':
        return Promise.reject(new errors.BadRequest(error));
      case 'OverwriteModelError':
        return Promise.reject(new errors.Conflict(error));
      case 'MissingSchemaError':
      case 'DivergentArrayError':
        return Promise.reject(new errors.GeneralError(error));
      case 'MongoError':
        return Promise.reject(new errors.GeneralError(error));
    }
  }

  return Promise.reject(error);
};
