function doGet(e) {
  var params = e.parameter;
  
  // 1. 파라미터가 없는 경우 (웹사이트 직접 접속 시) index.html 화면을 출력
  if (!params.date && !params.startDate && !params.prefix) {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('새마을운동중앙회 대치동사옥 시설관리')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 2. 파라미터가 있는 경우 (앱 내에서 데이터 요청 시) 기존 API 로직 수행
  var dateKey = params.date;
  var startDate = params.startDate;
  var endDate = params.endDate;
  var prefix = params.prefix || "";
  
  var sheet = getOrCreateSheet('DB_STORE');

  if (startDate && endDate) {
    var rangeData = getRangeData(sheet, startDate, endDate, prefix);
    return response({ status: 'success', data: rangeData });
  }

  if (!dateKey) {
    return response({ status: 'error', message: 'Parameter is missing' });
  }

  var data = getRowData(sheet, dateKey);
  
  var listKeys = [
    'STAFF_DB_MASTER', 'CONSUMABLES_DB', 'CONSUMABLE_REQ_DB', 
    'PARKING_CHANGE_DB', 'PARKING_STATUS_DB', 'CONTRACTOR_DB', 
    'FIRE_EXT_DB', 'TENANT_DB', 'ELEVATOR_INSPECTION_DB', 
    'EXTERNAL_WORK_DB', 'INTERNAL_WORK_DB', 'APPOINTMENT_DB',
    'FIRE_INSPECTION_HISTORY_DB'
  ];

  if (listKeys.indexOf(dateKey) !== -1) {
    var result = {};
    var fieldMap = {
      'STAFF_DB_MASTER': 'staff',
      'CONSUMABLES_DB': 'consumables',
      'CONSUMABLE_REQ_DB': 'consumableReq',
      'PARKING_CHANGE_DB': 'parkingChange',
      'PARKING_STATUS_DB': 'parkingStatus',
      'CONTRACTOR_DB': 'contractors',
      'FIRE_EXT_DB': 'fireExtList',
      'TENANT_DB': 'tenants',
      'ELEVATOR_INSPECTION_DB': 'inspectionList',
      'EXTERNAL_WORK_DB': 'workList',
      'INTERNAL_WORK_DB': 'workList',
      'APPOINTMENT_DB': 'appointmentList',
      'FIRE_INSPECTION_HISTORY_DB': 'fireHistoryList'
    };
    
    if (data && typeof data === 'object' && !Array.isArray(data) && data[fieldMap[dateKey]]) {
      result[fieldMap[dateKey]] = processOutputPhotos(data[fieldMap[dateKey]]);
    } else {
      result[fieldMap[dateKey]] = processOutputPhotos(data || []);
    }
    return response({ status: 'success', data: result });
  }

  return response({ status: 'success', data: processOutputPhotos(data) });
}

function doPost(e) {
  try {
    var content = e.postData.contents;
    var payload = JSON.parse(content);
    var dateKey = payload.targetKey || payload.date;
    
    if (!dateKey) return response({ status: 'error', message: 'Missing date key' });

    var sheet = getOrCreateSheet('DB_STORE');
    
    payload = processInputPhotos(payload, dateKey);

    var listKeyMap = {
      'STAFF_DB_MASTER': 'staff',
      'CONSUMABLES_DB': 'consumables',
      'CONSUMABLE_REQ_DB': 'consumableReq',
      'PARKING_CHANGE_DB': 'parkingChange',
      'PARKING_STATUS_DB': 'parkingStatus',
      'CONTRACTOR_DB': 'contractors',
      'FIRE_EXT_DB': 'fireExtList',
      'TENANT_DB': 'tenants',
      'ELEVATOR_INSPECTION_DB': 'inspectionList',
      'EXTERNAL_WORK_DB': 'workList',
      'INTERNAL_WORK_DB': 'workList',
      'APPOINTMENT_DB': 'appointmentList',
      'FIRE_INSPECTION_HISTORY_DB': 'fireHistoryList'
    };

    var finalData;
    if (listKeyMap[dateKey]) {
      finalData = payload[listKeyMap[dateKey]] || [];
    } else {
      var existingData = getRowData(sheet, dateKey);
      finalData = (existingData && typeof existingData === 'object' && !Array.isArray(existingData)) ? existingData : {};
      for (var key in payload) {
        if (key !== 'targetKey') finalData[key] = payload[key];
      }
    }

    updateRowData(sheet, dateKey, finalData);
    return response({ status: 'success', message: 'Data saved successfully' });
  } catch (error) {
    return response({ status: 'error', message: error.toString() });
  }
}

function getPhotoFolder() {
  var folderName = "Saemaul_Facility_Photos";
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    var folder = DriveApp.createFolder(folderName);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return folder;
  }
}

function saveBase64Image(base64Data, fileName) {
  if (!base64Data || typeof base64Data !== 'string' || !base64Data.startsWith('data:image')) {
    return base64Data; 
  }
  
  try {
    var folder = getPhotoFolder();
    var existingFiles = folder.getFilesByName(fileName);
    while (existingFiles.hasNext()) {
      var file = existingFiles.next();
      file.setTrashed(true);
    }
    var contentType = base64Data.substring(5, base64Data.indexOf(';'));
    var bytes = Utilities.base64Decode(base64Data.substring(base64Data.indexOf(',') + 1));
    var blob = Utilities.newBlob(bytes, contentType, fileName);
    var newFile = folder.createFile(blob);
    return "DRIVE_ID:" + newFile.getId(); 
  } catch (e) {
    console.error("Image Save Error: " + e.toString());
    return base64Data;
  }
}

function processInputPhotos(data, contextKey, entityId) {
  if (Array.isArray(data)) {
    return data.map(function(item, index) { 
      var id = (item && typeof item === 'object' && item.id) ? item.id : (entityId ? entityId + "_" + index : index);
      return processInputPhotos(item, contextKey, id); 
    });
  } else if (typeof data === 'object' && data !== null) {
    var currentId = data.id || entityId;
    for (var key in data) {
      if ((key === 'dataUrl' || key === 'photo') && typeof data[key] === 'string' && data[key].indexOf('data:image') === 0) {
        var fileName = contextKey + "_" + (currentId || "image") + ".jpg";
        data[key] = saveBase64Image(data[key], fileName);
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        data[key] = processInputPhotos(data[key], contextKey, currentId);
      }
    }
  }
  return data;
}

function processOutputPhotos(data) {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(processOutputPhotos);
  } else if (typeof data === 'object' && data !== null) {
    for (var key in data) {
      if (typeof data[key] === 'string' && data[key].startsWith('DRIVE_ID:')) {
        var id = data[key].replace('DRIVE_ID:', '');
        data[key] = "https://drive.google.com/thumbnail?id=" + id + "&sz=w1000";
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        data[key] = processOutputPhotos(data[key]);
      }
    }
  }
  return data;
}

function getOrCreateSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'DB_STORE') {
      sheet.appendRow(['Key', 'Data', 'LastUpdated']);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function normalizeKey(key) {
  if (key === null || key === undefined) return "";
  if (key instanceof Date) return Utilities.formatDate(key, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return key.toString().trim();
}

function getRowData(sheet, key) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var targetKey = normalizeKey(key);
  var dataRange = sheet.getRange(2, 1, lastRow - 1, 2);
  var values = dataRange.getValues();
  for (var i = 0; i < values.length; i++) {
    if (normalizeKey(values[i][0]) === targetKey) {
      return parseJson(values[i][1]);
    }
  }
  return null;
}

function getRangeData(sheet, start, end, prefix) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var results = [];
  var dataRange = sheet.getRange(2, 1, lastRow - 1, 2);
  var values = dataRange.getValues();
  for (var i = 0; i < values.length; i++) {
    var fullKey = normalizeKey(values[i][0]);
    var datePart = fullKey;
    if (prefix) {
      if (fullKey.indexOf(prefix) === 0) {
        datePart = fullKey.substring(prefix.length);
      } else {
        continue;
      }
    }
    if (datePart >= start && datePart <= end) {
      results.push({
        key: fullKey,
        data: parseJson(values[i][1])
      });
    }
  }
  return results;
}

function parseJson(jsonStr) {
  try {
    if (!jsonStr || jsonStr === "") return null;
    return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  } catch (e) {
    return null;
  }
}

function updateRowData(sheet, key, jsonData) {
  var lastRow = sheet.getLastRow();
  var rowIndex = -1;
  var targetKey = normalizeKey(key);
  if (lastRow >= 2) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (normalizeKey(keys[i][0]) === targetKey) {
        rowIndex = i + 2;
        break;
      }
    }
  }
  var jsonString = JSON.stringify(jsonData);
  var timestamp = new Date().toISOString();
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 2, 1, 2).setValues([[jsonString, timestamp]]);
  } else {
    var nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1).setNumberFormat('@'); 
    sheet.getRange(nextRow, 1, 1, 3).setValues([[targetKey, jsonString, timestamp]]);
  }
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}