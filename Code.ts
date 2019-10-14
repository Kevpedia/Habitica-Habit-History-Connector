function getConfig(request) {
  var config = {
    configParams: [
      {
        name: 'UserId',
        displayName: 'Habitica User ID',
        helpText: 'Enter the User ID found in https://habitica.com/#/options/settings/api',
        placeholder: '00000000-0000-0000-0000-000000000000'
      },
      {
        name: 'ApiToken',
        displayName: 'Habitica API Token',
        helpText: 'Enter the API Token found in https://habitica.com/#/options/settings/api',
        placeholder: '00000000-0000-0000-0000-000000000000'
      }
    ]
  };
  return config;
}

/** Data Schema w/ Sample Values
   * Task Name   Brush teeth
   * Task ID     0d50e4e3-feba-40fb-ba51-f987e9233b0f
   * Task Type   daily
   * Date        2017-02-02 11:35:34
   * Value       18.210684655562847
   */
var habitsDataSchema = [
  {
    name: 'task_name',
    label: 'Task Name',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION'
    }
  },
  {
    name: 'task_id',
    label: 'Task ID',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION'
    }
  },
  {
    name: 'task_type',
    label: 'Task Type',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION'
    }
  },
  {
    name: 'date',
    label: 'Date',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION'
    }
  },
  {
    name: 'value',
    label: 'Value',
    dataType: 'NUMBER',
    semantics: {
      conceptType: 'METRIC',
      isReaggregatable: true
    }
  }
];

function getSchema(request) {
  return {schema: habitsDataSchema};
}

function getData(request) {
  var dataSchema = [];
  request.fields.forEach(function(field) {
    for (var i = 0; i < habitsDataSchema.length; i++) {
      if (habitsDataSchema[i].name === field.name) {
        dataSchema.push(habitsDataSchema[i]);
        break;
      }
    }
  });
  
  // Set URL for Habitica API, history end-point
  var url = "https://habitica.com/export/history.csv";

  // Fetch the data.
  // By default URL fetch will throw an exception if the response code indicates failure.
  /** Example Data:
    Task Name,Task ID,Task Type,Date,Value
    Be Awesome,e826ddfa-dc2e-445f-a06c-64d3881982ea,habit,2016-06-02 13:26:05,1
    Be Awesome,e826ddfa-dc2e-445f-a06c-64d3881982ea,habit,2016-06-03 05:06:55,1.026657310999762
    ...
  **/
  var headers = {
    "x-api-user": request.configParams.UserId,
    "x-api-key": request.configParams.ApiToken
  }
  var options = {
    'method': "get",
    'headers': headers
  }
  try {
    var response = UrlFetchApp.fetch(url, options);
  }
  catch(e) {
    if (e.message.search("There is no account that uses those credentials.")!=-1) {
      logConnectorError(e, 'fetch-error-authorization'); // Log to Stackdriver.
      throwConnectorError("There is no Habitica account that uses those credentials."
      + "\nPlease visit https://habitica.com/user/settings/api and Enter the API User ID and Key from there into the connector configuraiton", true);
    }
    else {
      logConnectorError(e, 'fetch-error-other'); // Log to Stackdriver.
      throwConnectorError("Unable to Reach the Habitica API. Try again later.", true);
    }
  }
  
  try {
    var history = response.getContentText();
    var rows = history.split("\n");
    rows = rows.filter(function(row, index){
      if (index!=0) {
        return row
      }
    });
    rows = rows.map(function(row){
      var values = row.split(",");
      return {
        'task_name': values[0],
        'task_id': values[1],
        'task_type': values[2],
        'date': values[3],
        'value': values[4],
      }
    });
  }
  catch(e) {
    logConnectorError(e + "\nHistory Response: "+response, 'response-parsing-error'); // Log to Stackdriver.
    throwConnectorError("We're having some trouble parsing the response from Habitica.com", true);
  }

  // Prepare the tabular data.
  try {
    var data = [];
    rows.forEach(function(row) {
      var values = [];
      // Provide values in the order defined by the schema.
      dataSchema.forEach(function(field) {
        switch(field.name) {
          case 'task_name':
            values.push(row['task_name']);
            break;
          case 'task_id':
            values.push(row['task_id']);
            break;
          case 'task_type':
            values.push(row['task_type']);
            break;
          case 'date':
            values.push(row['date']);
            break;
          case 'value':
            values.push(row['value']);
            break;
          default:
            values.push('');
        }
      });
      data.push({
        values: values
      });
    });
  }
  catch (e) {
    logConnectorError(e, 'response-formatting-error'); // Log to Stackdriver.
    throwConnectorError("Unable to process data in required format.", true);
  }

  return {
    schema: dataSchema,
    rows: data
  };
}

function getAuthType() {
  var response = {
    "type": "NONE"
  };
  return response;
}

/**
  * Throws an error that complies with the community connector spec.
  * @param {string} message The error message.
  * @param {boolean} userSafe Determines whether this message is safe to show
  *     to non-admin users of the connector. true to show the message, false
  *     otherwise. false by default.
  */
function throwConnectorError(message, userSafe) {
  userSafe = (typeof userSafe !== 'undefined' &&
              typeof userSafe === 'boolean') ?  userSafe : false;
  if (userSafe) {
    message = 'DS_USER:' + message;
  }
  throw new Error(message);
}

/**
  * Log an error that complies with the community connector spec.
  * @param {Error} originalError The original error that occurred.
  * @param {string} message Additional details about the error to include in
  *    the log entry.
  */
function logConnectorError(originalError, message) {
  var logEntry = [
    'Original error (Message): ',
    originalError,
    '(', message, ')'
  ];
  console.error(originalError); // Log to Stackdriver.
}