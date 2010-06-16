/**
 * 
 */
function SWFU(id, settings) {
  var ref = {};
  ref.settings = {};

  ref.ajax_settings = {};
  ref.queue = {};
  ref.stats = {};
  ref.instance = {};
  ref.upload_stack_length = 0;
  ref.max_queue_size = 0;
  ref.upload_stack = {};
  ref.upload_stack_obj;
  ref.upload_button_obj;
  ref.upload_stack_size = 0;
  ref.wrapper_obj;
  ref.wrapper_id;
  ref.num_elements;
  ref.key_pressed;
  ref.message_wrapper_obj;
  ref.messages_timeout;

  /**
   * 
   */
  ref.init = function() {
    ref.settings = settings;
    ref.upload_button_obj = $('#' + ref.settings.upload_button_id);
    ref.instance = {name:settings.file_post_name};
    ref.ajax_settings = {
      type:"post",
      url:ref.settings.upload_url,
      data:{
        op:'init',
        file_path:ref.settings.post_params.file_path,
        instance:ref.toJson(ref.instance),
        widget:ref.settings.post_params.widget
      },
      success:function(result) {
        ref.ajaxResponse(result);
      }
    };

    ref.prepareSWFButton();
    // Get the instance data by an AJAX request in order to let other modules change the callbacks and elements for this instance (using hook_swfupload);
    $.ajax(ref.ajax_settings);
  };

  /**
   * Prepares the swfupload button.
   */
  ref.prepareSWFButton = function() {
    // Create a copy of the button to get it's dimensions.
    // If we'd use the original button, we could end up with dimensions equal to 0px when the button is inside a hidden fieldset.
    var tmp_button = ref.upload_button_obj.clone().css({'position':'absolute'}).prependTo('body');

    // Set the dimensions of the swf so it matches exactly the dimensions of the upload button
    // swfupload.swf will be placed exactly over the upload button
    ref.settings.button_width = (tmp_button.find('.left').width() + tmp_button.find('.center').width() + tmp_button.find('.right').width());
    ref.settings.button_height = tmp_button.find('.center').height();
    tmp_button.remove();

    // Add the other button settings to the settings object
    ref.settings.button_placeholder_id = ref.settings.file_post_name + '-swfwrapper';
    ref.settings.button_window_mode = SWFUpload.WINDOW_MODE.TRANSPARENT;
    ref.settings.button_cursor = SWFUpload.CURSOR.HAND;
  };

  /**
   * Creates a hidden input field which will contain a JSON formatted string containing all uploaded files
   */
  ref.createStackObj = function() {
    var upload_stack_value = settings.custom_settings.upload_stack_value;
    ref.max_queue_size = settings.custom_settings.max_queue_size;
    ref.upload_stack_obj = $('<input type="hidden" />').attr('name', ref.instance.name).val(upload_stack_value).prependTo(ref.upload_button_obj);
    ref.upload_stack = Drupal.parseJson(upload_stack_value);
    ref.upload_stack_length = ref.objectLength(ref.upload_stack);
  };

  /**
   * 
   */
  ref.newSWFUpload = function() {
    ref.swfu = new SWFUpload(ref.settings);
  };

  /**
   * 
   */
  ref.ajaxResponse = function(result) {
    var result = Drupal.parseJson(result);

    switch (result.op) {
      case 'init':
        ref.instance = result.instance;
        ref.num_elements = ref.objectLength(ref.instance.elements);
        $.each(result.instance.callbacks, function(setting, callback) {
          ref.settings[setting] = eval(callback);
        });
        ref.newSWFUpload();
        ref.settings.init_complete_handler(result);
        break;
    };
    ref.addEventHandlers(result.op);
  };

  /**
   * Custom function for when the initialization is complete
   * This event handler is defined in swfupload.module as an instance callback function 
   */
  ref.initComplete = function(result) {
    ref.createWrapper(result.instance.name);
    ref.createStackObj();
    ref.addStoredFiles();

    // Enable the upload button if the current stack is smaller than the allowed stack size,
    // or when there's no limit at all.
    if ((ref.settings.file_upload_limit && (ref.upload_stack_length < ref.settings.file_upload_limit)) || ref.settings.file_upload_limit === 0) {
      ref.upload_button_obj.removeClass('disabled').css({opacity:1});
    }
    else {
      ref.upload_button_obj.addClass('disabled').css({opacity:0.4});
    };
  };

  /**
   * This will process all file elements stored in the upload stack.
   * The upload represents all files submitted in the upload form.
   * For all files in the stack, a file element will be added to the wrapper using ref.addFileItem().
   */
  ref.addStoredFiles = function() {
    for(var i in ref.upload_stack) {
      if (ref.upload_stack[i] == 0) {
        break;
      };
      ref.upload_stack[i].id = i;
      ref.upload_stack[i].fid = i;
      ref.upload_stack[i].extension = ref.getExtension(ref.upload_stack[i].filename);
      ref.addFileItem(ref.upload_stack[i]);

      // Adjust the bytes in the stack.
      ref.upload_stack_size += parseInt(ref.upload_stack[i].filesize);
    };
    ref.addEventHandlers('drag_enable');
  };

  /**
   * Places the wrapper markup above the upload button
   * Depending on what type isset by the instance, a table or a list element is created.
   */
  ref.createWrapper = function(field_name) {
    var use_header = false;
    var element;

    if (ref.num_elements > 1 && ref.instance.type == 'table') {
      // First we'll check if we need to create a header 
      for (var name in ref.instance.elements) {
        if (ref.instance.elements[name].title) {
           use_header = true;
        };
      };

      ref.wrapper_id = 'swfupload_file_wrapper-' + field_name;
      ref.wrapper_obj = $('<table />').attr({'id': ref.wrapper_id, 'class':'swfupload'});
      if (use_header) {
        ref.wrapper_obj.append($('<thead />').append(ref.tableRow(true)));
      };
      ref.wrapper_obj.append($('<tbody />').append(ref.tableRow()));
      ref.upload_button_obj.before(ref.wrapper_obj);

      if (!Drupal.settings.tableDrag) {
        Drupal.settings.tableDrag = {};
      };

      Drupal.settings.tableDrag['swfupload_file_wrapper-' + field_name] = {};
    };
  };    

  /**
   * Creates or changes a tablerow
   * @param header Boolean Wheter or not the tablerow should contain th's. If sety to false, td's will be generated.
   * @param file Object A completed file object 
   *   - If this is not set, a row is created including the progressbar, which replaces the td's with contains_progressbar set to true.
   *   - If file is set, the progressbar will be replaced with the appropriate td's
   */
  ref.tableRow = function(header, file) {
    var counter = 0;
    var colspan = 0;
    var fid = (file) ? file.fid : 0;
    var progress_td_counter = 0;
    var element, colum, content, input, progress_td, elem_value, value;

    var tr = (file) ? $('#' + file.fid) : $('<tr />');
    var wrapper = $('<div />').addClass('wrapper');
    var left_span = $('<div />').addClass('left').html('&nbsp;');
    var center_span = $('<div />').addClass('center');
    var right_span = $('<div />').addClass('right').html('&nbsp;');

    // A tablerow will be created containing all elements defined in ref.instance.elements.
    // If file is set, all elements will be skipped exept the ones with 'contains_progressbar'
    // If file isn't set, this tablerow will be hidden.
    for (var name in ref.instance.elements) {
      counter++;
      element = ref.instance.elements[name];

      if (file) {
        if(!element.contains_progressbar) {
          // The current td doesn't have to be replaced.
          // We only need to replace fid of the id and name of the input field
          tr.find('#edit-' + name + '_0').attr({'name':name +'_' + fid, 'id':'edit-' + name + '_' + fid});
          continue;
        };
      }
      else {
        if (!header && element.contains_progressbar) {
          if (!progress_td) {
            progress_td = $('<td />').addClass('progress').append($('<div />').addClass('sfwupload-list-progressbar').append($('<div />').addClass('sfwupload-list-progressbar-status')).append($('<div />').addClass('sfwupload-list-progressbar-glow'))).appendTo(tr);
          };
          progress_td_counter++;
          continue;
        };
      };

      column = $((header ? '<th />' : '<td />'));
      content = wrapper.clone().appendTo(column);
      input = $((element.type == 'textarea' ? '<textarea />' : '<input type="' + element.type + '" />')).attr({'name':name +'_' + fid, 'id':'edit-' + name + '_' + fid}).addClass('form-' + element.type);

      if (header) {
        // Keep track of colspans 
        if (colspan > 0) colspan--;
        if (element.colspan) {
          colspan = element.colspan;
        }
        else if (colspan !== 0) {
          continue;
        };

        // Add the colspan if set.
        if (element.colspan) {
          column.attr({'colSpan':element.colspan});
        };

        // Add a separator only if we're not dealing with the first or last column
        if (counter !== ref.num_elements && (counter + (colspan - 1) !== ref.num_elements) && element.add_separator) {
          content.append(left_span.clone()).append(right_span.clone());
        };

        content.append(center_span.clone().html((element.title ? element.title : '&nbsp;')));
      }
      else {
        elem_value = (element.value) || element.default_value;
        // Create the content for this td
        // Depending on the type the appropriate input field is appended to store the values of this type
        switch (element.type) {
          case 'icon':
          case 'cancel':
            content.append($('<div />').addClass('sfwupload-list-' + (element.type == 'icon' ? 'mime' : element.type)));
            break;
          case 'textfield':
          case 'textarea':
            value = (file ? ref.replaceMacros(elem_value, file) : elem_value);
            content.append($('<span />').html((value !== '' ? value : '&nbsp;'))).append(input.css({'display':'none'}).val((value ? value : '')));
            break;
          case 'checkbox':
            value = (file[name] !== undefined) ? (typeof(file[name]) == 'string' ? (file[name] == '1') : file[name]) : elem_value;
            // For IE we need to check the checkbox after the content has been added to the tr.
            // We'll temporarily store it's value in a classname
            content.append(input.addClass('checkbox ' + (value ? 'checked' : '')));
            break;
          case 'markup':
            value = (file) ? (file[name] !== undefined) ? file[name] : ref.replaceMacros(elem_value, file) : elem_value;
            content.append($('<div />').addClass('swfupload-markup').attr('id', 'swfupload-markup-' + name).html(value));
            break;
          default:
            break;
        };
      };

      // Add a classname if set.
      if (element.classname) {
        column.addClass(element.classname);
      };

      if (file && element.contains_progressbar) {
        column.insertBefore(tr.find('td.progress'));
      }
      else {
        tr.append(column);
      };
    };

    if (!header && !file) {
      // Hide the tablerow
      tr.addClass('hidden');
    };

    if (progress_td) {
      progress_td.attr({'colSpan':progress_td_counter});
    };

    // Update the checked value of all added checkboxes 
    tr.find('input.checkbox').each(function() {
      $(this).attr('checked', $(this).hasClass('checked'));
    });

    if (file) {
      tr.addClass('processed').find('td.progress').remove();
    }
    else {
      // Create borders
      var border = $(header ? '<th />' : '<td />').addClass('border').append($('<img />').attr({'src':Drupal.settings.basePath + ref.settings.module_path + '/images/spacer.gif'}).css({'width':'1px'}));
      tr.prepend(border.clone()).append(border);
      return tr;
    };
  };

  /**
   * A file has been selected. This function creates the markup referring to the new file object
   */
  ref.addFileItem = function(file) {
    // Create the markup for the new file by copying the hidden template 
    var new_file_obj = ref.wrapper_obj.find('.hidden').clone().attr({'id':file.id}).appendTo(ref.wrapper_obj);
    var dom_obj, value, elem_value;

    // Remove tabledrag elements
    new_file_obj.find('a.tabledrag-handle').remove();

    // If it is a file earlier stored (a file in the upload_stack), remove it's progressbar.
    if (file.filestatus !== -1) {
      ref.tableRow(false, file);
    };

    // Replace macro's
    for (var name in ref.instance.elements) {
      dom_obj = new_file_obj.find('#edit-' + name + '_' + (file.fid || '0') + ', #swfupload-markup-' + name);
      if (dom_obj.size() > 0) {
        elem_value = (ref.instance.elements[name].value) || ref.instance.elements[name].default_value;
        value = (file[name] !== undefined) ? file[name] : ref.replaceMacros(elem_value, file);

        if (dom_obj[0].tagName.toLowerCase() == 'input' || dom_obj[0].tagName.toLowerCase() == 'textarea') {
          dom_obj.val(value);
        }
        else {
          dom_obj.html(value).show();
        };

        // If the inputfield is hidden, we're dealing with a string. 
        // Look if there is a span of which the text can be replaced
        if (dom_obj.css('display') == 'none') {
          dom_obj.parent().find('span').text(value);
        };
      };
    };

    if (file.thumb) {
      // Attach the thumbnail image
      new_file_obj.find('.sfwupload-list-mime').css({'background-image': 'url(' + file.thumb + ')'});
    }
    else {
      // Add the extension to the mime icon
      new_file_obj.find('.sfwupload-list-mime').addClass(file.extension);
    };

    // Fix transparency for IE6
    if ($.cssPNGFix) {
      new_file_obj.find('.sfwupload-list-mime').cssPNGFix();
    };

    new_file_obj.removeClass('hidden').addClass('draggable');
    ref.addEventHandlers((file.filestatus == -1 ? 'file_queued' : 'file_added'), file);
  };

  /**
   * Attaches all event handlers to the loaded markup
   */
  ref.addEventHandlers = function(op, file) {
    switch (op) {
      case 'flash_loaded':
        ref.upload_button_obj.find('.swfupload-wrapper .swfupload').mousedown(function() {
          $(this).parent().parent().addClass('active');
        }).mouseup(function() {
          $(this).parent().parent().removeClass('active');
        });
        break;

      case 'file_queued':
        $('#' + file.id).find('.sfwupload-list-cancel').click(function() {
          ref.cancelUpload(file);
        });
        break;

      case 'file_added':
        var file_element_obj = $('#' + file.fid);
        file_element_obj.find('.sfwupload-list-cancel').unbind('click').click(function() {
          ref.removeFileItem(file);
        }).disableTextSelect();
        file_element_obj.find('input:checkbox').bind('click', function() {
          ref.updateStack(file);
        });
        file_element_obj.find('input:text, textarea').blur(function() {
          ref.toggleInput($(this), false, file);
        }).keydown(function(e) {
          ref.key_pressed = e.keyCode;
          if ((e.keyCode == 27) || (e.keyCode == 13 && $(this).get(0).tagName.toLowerCase() !== 'textarea')) {
            $(this).blur();
            return false;
          };
        }).parents('td').dblclick(function() {
          ref.toggleInput($(this).find('span'), true, file);
        }).find('.wrapper').append($('<a href="#" />').text(Drupal.t('edit')).addClass('toggle-editable').click(function() {
          ref.toggleInput($(this).parent().find('span'), true, file);
          return false;
        }));
        break;

      case 'drag_enable':
        // Attach the tabledrag behavior
        // This will we only executed once.
        Drupal.attachBehaviors(ref.wrapper_obj);
    
        $('tbody tr', ref.wrapper_obj).not('.hidden, .tabledrag-handle-swfupload-moved').each(function() {
    
          if (!$('a.tabledrag-handle', $(this)).size()) {
            Drupal.tableDrag[ref.wrapper_id].makeDraggable(this);
          };
    
          $('a.tabledrag-handle', $(this)).not('.tabledrag-handle-swfupload-moved').each(function() {
            $(this).appendTo($(this).parents('tr').addClass('tabledrag-handle-swfupload-moved').find('td.drag div.wrapper')).bind('mousedown', function() {
              $(this).parents('tr').addClass('dragging');
            });
          });
        });
    
        $(document).unbind('mouseup', ref.tableDragStop).bind('mouseup', ref.tableDragStop);
        break;

      default:
        break;
    };
  };

  /**
   * Triggered when the user has stopped dragging a tablerow.
   */
  ref.tableDragStop = function() {
    $('tr', ref.wrapper_obj).removeClass('dragging');
    $(ref.wrapper_obj).parent().children('.warning').css({'visibility':'hidden'}).remove();
    ref.updateStack();
  };

  /**
   * Toggles editability of text spans inside tablerows
   */
  ref.toggleInput = function(obj, start, file) {
    obj.hide().parent().toggleClass('editable-enabled');
    if (start) {
      obj.hide().parent().find('input:text, textarea').show().focus().select();
    }
    else {
      if (ref.key_pressed == 27) {
        obj.val(obj.parent().find('span').html()).hide().parent().find('span').show();
        return;
      };

      var value = obj.val();
      if (value == '') {
        obj.hide().parent().find('span').html('&nbsp;').show();
      }
      else {
        obj.hide().parent().find('span').text((value == '&nbsp;' ? '' : value)).show();
      };
    };
    ref.updateStack(file);
  };

  /**
   * Launched when the swf has been loaded.
   */
  ref.swfUploadLoaded = function() {
    // Update the stats object in order to let SWFUpload know we've already got some files stored
    ref.swfu.setStats({successful_uploads: ref.upload_stack_length});
    ref.addEventHandlers('flash_loaded');
  };

  /**
   * The file(s) have been selected.
   */
  ref.dialogComplete = function(files_selected, files_queued) {
    if (ref.settings.file_upload_limit && ref.settings.file_upload_limit !== 0 && (files_selected > ref.settings.file_upload_limit)) {
      ref.displayMessage(Drupal.t('You can upload only !num !file!', {'!num':ref.settings.file_upload_limit, '!file': Drupal.formatPlural(ref.settings.file_upload_limit, 'file', 'files')}), 'error');
    }
    else {
      ref.uploadNextInQueue();
    };
  };

  /**
   * The file(s) have been selected by the user and added to the upload queue
   */
  ref.fileQueued = function(file) {
    if (ref.settings.file_upload_limit && ref.settings.file_upload_limit !== 0) {
      // Check if the queued file(s) do not exceed the max number of files
      var stats = ref.swfu.getStats();
      if ((ref.upload_stack_length + stats.files_queued) > ref.settings.file_upload_limit) {
        ref.swfu.cancelUpload(file.id);
        var queue_space = (ref.settings.file_upload_limit - ref.upload_stack_length);
        if (queue_space == 0) {
          ref.displayMessage(Drupal.t('You are not allowed to add more than !num !file!', {'!num':ref.settings.file_upload_limit, '!file': Drupal.formatPlural(ref.settings.file_upload_limit, 'file', 'files')}), 'error');
        }
        else {
          ref.displayMessage(Drupal.t('You can upload only !num more !file!', {'!num':queue_space, '!file':Drupal.formatPlural(queue_space, 'file', 'files')}), 'error');
        };
        return;
      };
    };
    if (ref.max_queue_size && ref.max_queue_size !== 0) {
      // Check if the new file does not exceed the max queue size
      if ((ref.upload_stack_size + file.size) > ref.max_queue_size) {
        var max_queue_mbs = ref.getMbs(ref.max_queue_size);
        var file_mbs = ((file.size / 1024) / 1024);
        ref.swfu.cancelUpload(file.id);
        ref.displayMessage(Drupal.t('The file size (!num1 MB) exceeds the upload size (!num2 MB) for this page!', {'!num1':file_mbs.toFixed(2), '!num2':max_queue_mbs.toFixed(2)}), 'error');
        return;
      };
    };
    // No problems found, add the new file to the stack.
    file.extension = ref.getExtension(file.name);
    ref.queue[file.id] = file;
    ref.addFileItem(file);
  };

  /**
   * Responds on file queue errors 
   */
  ref.fileQueueError = function(file, code, message) {
    switch (code) {
      case -110: // The file selected is too large
        var max_file_mbs = ref.getMbs(ref.settings.file_size_limit);
        var file_mbs = ((file.size / 1024) / 1024);
        ref.displayMessage(Drupal.t('The file size (!num1 MB) exceeds the file size limit (!num2 MB)!', {'!num1':file_mbs.toFixed(2), '!num2':max_file_mbs.toFixed(2)}), 'error');
        break;
      default:
        break;
    };
  };

  /**
   * Calculates the MB's from a given string
   */
  ref.getMbs = function(size) {
    // B, KB, MB and GB
    if (size.indexOf('MB') > -1) {
      return parseInt(size);
    }
    else if (size.indexOf('GB') > -1) {
      return (parseInt(size) * 1024);
    }
    else if (size.indexOf('KB') > -1) {
      return (parseInt(size) / 1024);
    }
    else if (size.indexOf('B') > -1) {
      return ((parseInt(size) / 1024) / 1024);
    };
    return false;
  };

  /**
   * Displays messages
   */
  ref.displayMessage = function(messages, type) {
    if (typeof(messages) == 'object') {
      var multiple = (messages.length > 1);
      var messages_tmp = (multiple ? '<ul>' : '');
      for (var i in messages) {
        messages_tmp += (multiple ? '<li>' + messages[i] + '</li>' : messages[i]);
      };
      messages = (multiple ? messages_tmp + '</ul>' : messages_tmp);
    };

    if (!ref.message_wrapper_obj) {
      ref.message_wrapper_obj = $('<div />').addClass('swfupload-messages').insertAfter(ref.wrapper_obj);
      ref.messages_timeout = setTimeout(function() {ref.hideMessages();}, 5000);
    };

    if (!$('div.' + type, ref.message_wrapper_obj).size()) {
      ref.message_wrapper_obj.append($('<div />').css({'height':'auto', 'opacity':1}).addClass('messages ' + type).html(messages));
    }
    else {
      // The messagewrapper already exists. Add the new message to the wrapper and reset the timeout.

      // Check if the message isn't already displayed
      if (ref.message_wrapper_obj.html().indexOf(messages) > -1) {
        return;
      };

      // If the new type differs from the current type, we'll remove the old message.
      if ((ref.message_wrapper_obj.hasClass('status') && type !== 'status') || (ref.message_wrapper_obj.hasClass('error') && type !== 'error')) {
        ref.message_wrapper_obj.removeClass('status error').addClass(type).html(messages);
      }
      else {
        ref.message_wrapper_obj.append('<br />' + messages);
      };
      clearInterval(ref.messages_timeout);
      ref.messages_timeout = setTimeout(function() {ref.hideMessages();}, 5000);
    };
  };

  /**
   * Slowly hides the messages wrapper
   */
  ref.hideMessages = function() {
    ref.message_wrapper_obj.animate({'height':'0px', 'opacity':0}, 'slow', function() {
      ref.message_wrapper_obj.remove();
      ref.message_wrapper_obj = false;
    });
  };

  /**
   * Triggers a new upload.
   */
  ref.uploadNextInQueue = function() {
		try {
		  ref.swfu.startUpload();
		}
		catch (err) {
		  ref.swfu.debug(err);
		};
  };

  /**
   * Adjusts the progress indicator.
   */
  ref.uploadProgress = function(file, complete, total) {
     // We don't want this one to end up to 100% when all bytes are loaded. The progressbar will have an width of 100% on uploadFileComplete
    var done = Math.round((96 / total)  * complete);
    $('#' + file.id + ' .sfwupload-list-progressbar-status').css({'width': done + '%'});
  };

  /**
   * Handles upload errors
   */
  ref.uploadError = function(file, code, message) {
    // Check for messages which can be handled as 'status' messages
    switch (code) {
      case -240:
        ref.displayMessage(Drupal.t('The upload limit (!num) has been reached!', {'!num': ref.settings.file_upload_limit}), 'status');
        return;
      case -200:
        message = Drupal.t('Server error!', {'!num': ref.settings.file_upload_limit});
    };

    // Give the user some visual indicators of the event
    $('#' + file.id + ' .sfwupload-list-progressbar').addClass('stopped').find('.sfwupload-list-progressbar-status').css({'width':'100%'});
    $('#' + file.id + ' .sfwupload-list-progressbar-glow').append((typeof(message) == 'object' ? message[0] : message));

    // If a file is set, we need to remove the added file DOM element
    if (file) {
      setTimeout(function() {
        ref.removeFileItem(file);
      }, 2000);
    };
  };

  /**
   * Triggered after the upload is succesfully completed.
   */
  ref.uploadComplete = function(file) {
    if (ref.queue[file.id] && !ref.queue[file.id].cancelled) {
      setTimeout(function() {
        $('#' + ref.queue[file.id].fid).find('.sfwupload-list-progressbar').animate({'opacity':0}, "slow", function() {
          file.fid = ref.queue[file.id].fid;
          ref.tableRow(false, file);
          ref.updateStack(file);
          ref.addEventHandlers('file_added', file);

          if (ref.queue[file.id].thumb) {
            $('.sfwupload-list-mime', $('#' + ref.queue[file.id].fid)).css({'background-image': 'url(' + ref.queue[file.id].thumb + ')'});
          };
          ref.upload_button_obj.removeClass('swfupload-error');
        });
      }, 1000);
    };
		ref.uploadNextInQueue();
  };

  /**
   * Retrieves the data returned by the server
   */
  ref.uploadSuccess = function(file, server_data) {
    var server_data = Drupal.parseJson(server_data);

    // Check for messages returned by the server.
    if (server_data.messages) {

      // Check if the server returned status messages
      if (server_data.messages) {
        for (var type in server_data.messages) {
          if (type !== 'swfupload_error') {
            ref.displayMessage(server_data.messages[type], type);
          };
        };
      };

      // Check if the server returned an error
      if (server_data.messages.swfupload_error) {
        ref.uploadError(file, null, server_data.messages.swfupload_error);
        ref.queue[file.id].cancelled = true;
        return;
      };
    };

    // No errors. Complete the fileupload.
    ref.queue[file.id].fid = server_data.file.fid;
    $('#' + file.id).attr({'id':server_data.file.fid}).find('.sfwupload-list-progressbar-status').css({'width':'100%'}).parent().addClass('complete');

    if (server_data.file.thumb) {
      ref.queue[file.id].thumb = server_data.file.thumb;
    };
  };

  /**
   * Updates the value of the hidden input field which stores all uploaded files
   */
  ref.updateStack = function(file) {
    var fid, input_field, element;
    var old_upload_stack = ref.upload_stack;
    var total_size = 0;
    ref.upload_stack = {};

    ref.wrapper_obj.find('.processed').each(function() {
      fid = $(this).attr('id');

      // If no file is secified, the function is called after sorting
      // There are no new values so the file object is not needed
      // We only need to change the order of the stack 
      if (!file) {
        ref.upload_stack[fid] = old_upload_stack[fid];
      }
      else {
        ref.upload_stack[fid] = {filename:file.filename || file.name, fid:fid};
        total_size += parseInt(file.size);
        for (var name in ref.instance.elements) {
          input_field = $('#edit-' + name + '_' + fid);
          if (input_field.size() !== 0) {
            ref.upload_stack[fid][name] = (input_field.attr('type') == 'checkbox') ? input_field.attr('checked') : input_field.val();
          };
        };
      };
    });
    ref.upload_stack_size = total_size;
    ref.upload_stack_length = ref.objectLength(ref.upload_stack);
    ref.upload_stack_obj.val(ref.toJson(ref.upload_stack));
    ref.addEventHandlers('drag_enable');

    if ((ref.settings.file_upload_limit > ref.upload_stack_length) || ref.settings.file_upload_limit === 0) {
      ref.upload_button_obj.removeClass('disabled').css({opacity:1});
    }
    else {
      ref.upload_button_obj.addClass('disabled').css({opacity:0.4});
    };
  };

  /**
   * Aborts a file upload
   */
  ref.cancelUpload = function(file) {
    // Check if the file is still being uploaded.
    if (ref.swfu.getFile(file.id)) {
      // Abort the upload
      ref.swfu.cancelUpload(file.id);
      ref.queue[file.id].cancelled = true;
      setTimeout(function() {
        ref.removeFileItem(file);
      }, 1000);
    };
  };

  /**
   * Removes a file form the list
   */
  ref.removeFileItem = function(file) {
    var file_tr = $('#' + (file.fid ? file.fid : file.id)).removeClass('processed');
    var file_tds = file_tr.find('td');
    var current_height = file_tr.height();
    var cleared = false;

    // Delete the file from the queue
    delete(ref.queue[file.id]);

    // Animate the deletion of the file's table row
    // First fade out the contents of the td's
    file_tds.find('div, input').animate({opacity:0}, 'fast', function() {
      file_tds.each(function() {
        // The contents are not visible anymore, so we can remove it.
        $(this).html('');
      });

      // Since animate({height:0}) does not work for tr and td's, we need to declare our own interval
      var intv = setInterval(function() {
        current_height -= 5;
        file_tds.height(current_height);
        file_tr.css({opacity: current_height * 4});

        // The animation is complete
        if(current_height <= 5) {
          if (!cleared) {
            cleared = true;
            file_tr.remove();
            clearInterval(intv);

            // Reset the successfull upload queue
            var stats = ref.swfu.getStats();
            stats.successful_uploads--;
            ref.swfu.setStats(stats);

            if (file_tr) {
              // Update the hidden input field
              ref.updateStack(file);
            };
          };
        };
      }, 50);
    });
  };

  /**
   * Retrieve the number of elements in an object
   */
  ref.objectLength = function(obj) {
    if (obj.status !== undefined && obj.status == 0) return 0;

    var count = 0;
    for (var i in obj)
    count++;
    return count;
  };

  /**
   * Parses an object to a json formatted string
   */
  ref.toJson = function(v) {
    switch (typeof v) {
      case 'boolean':
        return v == true ? 'true' : 'false';
      case 'number':
        return v;
      case 'string':
        return '"'+ v.replace(/\n/g, '\\n') +'"';
      case 'object':
        var output = '';
        for(i in v) {
          output += (output ? ',' : '') + '"' + i + '":' + ref.toJson(v[i]);
        }
        return '{' + output + '}';
      default:
        return 'null';
    };
  };

  /**
   * 
   */
  ref.getExtension = function(file_name) {
    return file_name.substring(file_name.lastIndexOf('.') + 1).toLowerCase();
  };

  /**
   * Replaces default values from ref.instance.elements to file values
   * @see ref.uploadComplete
   */
  ref.replaceMacros = function(value, file) {
    if (!value || value == 0) {
      return false;
    }
    else if (value == 1) {
      return true;
    }
    else {
      var macros = {'[filename]':file.name, '{fid}':file.fid};
      for (var i in macros) {
        value = value.replace(i, macros[i]);
      };
      return value;
    };
  };

  /**
   * Reverses the order of an object
   */
  ref.objReverse = function(obj) {
    var temp_arr = [];
    var temp_obj = {};

    for (var i in obj) {
      temp_arr.push({key:i, data:obj[i]});
    };
    temp_arr = temp_arr.reverse();
    for (var i in temp_arr) {
      temp_obj[temp_arr[i].key] = temp_arr[i].data;
    };    
    return temp_obj;
  };

  return ref;
};

/**
 * Overwrite for the TableDrag markChanged function
 * Allows to place the marker in an other table drawer than the first one.
 */
Drupal.tableDrag.prototype.row.prototype.markChanged = function() {
  var marker = Drupal.theme('tableDragChangedMarker');
  var cell = ($('td.drag .wrapper', this.element)) || $('td:first', this.element);
  if ($('span.tabledrag-changed', cell).length == 0) {
    cell.append(marker);
  };
};

/**
 * Disables text selection on the DOM element the behavior is attached to.
 */
jQuery.fn.disableTextSelect = function() {
  return this.each(function() {
    $(this).css({
      'MozUserSelect' : 'none'
    }).bind('selectstart', function() {
      return false;
    }).mousedown(function() {
      return false;
    });
  });
};

$(function() {
  if (Drupal.settings.swfupload_settings) {
    Drupal.swfu = {};
    var settings = Drupal.settings.swfupload_settings;

    for (var id in settings) {
      Drupal.swfu[id] = new SWFU(id, settings[id]);
      Drupal.swfu[id].init();
    };
  };
});
