sfwupload Module
================================================================================

DESCRIPTION:
--------------------------------------------------------------------------------
The SWFUpload module provides an CCK widget for filefield and handles the upload
through javascript/flash. It depends on the SWFUpload library which makes it
possible to upload multiple file at once.

For developers the module provides a hook function. Using this hook function
developers can alter the way the widget is presented, op hook in to the file
upload process.


INSTALLATION:
--------------------------------------------------------------------------------
1. Download the FileField module.
     (http://drupal.org/project/filefield)

2. Download the jQuery Plugin Handler (jQp) module. This module is required for
   loading the SWFUpload javascript library.
     (http://drupal.org/project/filefield)

3. Place both modules, as well as the SWFUpload module, in your module
   directory.
     (sites/all/modules)

4. If you do not have created a 'libraries' directory yet, create one.
     (sites/all/libraries)

5. Create a new directory called 'swfupload' inside the 'libraries' folder.
     (sites/all/libraries)

6. Download the SWFUpload 2.2.0.1 release.
     (http://code.google.com/p/swfupload/downloads/list)

7. Copy the files 'swfupload.swf' and 'swfupload.js' to the swfupload folder 
   inside the libraries folder. The end result will read:
     sites/all/libraries/swfupload/swfupload.js
     sites/all/libraries/swfupload/swfupload.swf

8. Enable this module by navigating to:
     admin/build/modules


USAGE:
--------------------------------------------------------------------------------
Create a new file field in through CCK's interface. Visit Administer -> Content
management -> Content types (admin/content/types), then click Manage fields on
the type you want to add an SWFUpload field. Select "File" as the field type and
"SWFUpload" as the widget type to create a new field.

API:
--------------------------------------------------------------------------------

Developers can take the advantage of the hook function hook_swfupload(). Using 
this function developers have access to alter the way the files are displayed,
as well as how file uploads are processed. 

HOOK_SWFUPLOAD():

  DEFINITION:

  hook_swfupload(&$file, $op, &$instance, $widget)
  

  DESCRIPTION:

  Provide other modules a hook to change the data for the swfupload scripts.
  Modules can change the default provided fields, customize the way files are
  uploaded and change the type of swfupload (table or button).

  PARAMETERS:

  $file: The file object in its different states. 

  $op: What kind of action is being performed. Possible values:
    
    'init': The swfupload is being initialized. Here you can change the instance
            object in order to define other javascript callback functions, or to
            change the way the files are displayed.

    'move_uploaded_file': The swfupload requests an upload. Here you can alter 
            the file object in order to change it's filename or the destination
            folder. You can also change the validation functions which are passed 
            to file_save_upload(). The file object will look something similar 
            like this: 

            $file = (object) array(
              'validators' => array(
                'file_validate_extensions => 'jpg jpeg gif png txt',
                'filefield_validate_image_resolution' => array('800x600', '100x100'),
                'file_validate_size' => array($widget->max_filesize_per_file, $widget->max_filesize_per_file),
              ),
              'file_path' => 'files/'
            );

    'upload_complete': The upload is complete. Using the hook_function in this 
            state, the file can be copied, modified or you can do some database 
            stuff. The file object will look something similar like this:

            $file = (object) array(
                'filename' => 'Image1.png',
                'filepath' => 'files/Image1_3.png',
                'filemime' => 'image/png',
                'source' => 'upload',
                'destination' => 'files/Image1_3.png',
                'filesize' => 220567,
                'uid' => '3',
                'status' => 0,
                'timestamp' => 1227182505,
                'fid' => '2468' }
              ),
              'filepath' => 'files/'
            );

  $instance: The instance object in its different states. When $op is 'init' the 
      instance can be altered in order to change the callback functions or to change
      the way the upload module displayes files. When $op is 'move_uploaded_file' or 
      'upload_complete', the instance object can be used as a reference.
      The reference object on init:

      // The type of the instance. Currently only table is supported
      $instance->type = 'table';

      // Javascript callback functions
      $instance->callbacks = array(
        'swfupload_loaded_handler' => 'ref.swfUploadLoaded',
        'file_queued_handler' => 'ref.fileQueued',
        'queue_complete_handler' => 'ref.queueComplete',
        'file_queue_error_handler' => 'ref.fileQueueError',
        'file_dialog_complete_handler' => 'ref.dialogComplete',
        'upload_success_handler' => 'ref.uploadSuccess',
        'upload_progress_handler' => 'ref.uploadProgress',
        'upload_error_handler' => 'ref.uploadError',
        'upload_complete_handler' => 'ref.uploadComplete',
        'init_complete_handler' => 'ref.initComplete',
      );

      // The $instance->elements array represents all elements (or columns) which are displayed on added files.
      // Each element can be changed. Javascript will render the proper markup.
      // By default the elements below are used for each added file, however by changing the widget settings, an 'alt', 'title', 'description' or 'list' column can be added.
      $instance->elements = array(
        'drag' => array(
          'class' => 'drag first indentation',
          'type' => 'drag',
          'colspan' => 3,
          'title' => t('Filename'),
          'add_separator' => TRUE,
        ),
        'icon' => array(
          'type' => 'icon',
          'class' => 'icon',
        ),
        'filename' => array(
          'type' => 'markup',
          'value' => '[filename]',
          'class' => 'text title',
        ),
      );

  EXAMPLE:

  /**
   * Implementation of hook_swfupload().
   */
  function MODULENAME_swfupload(&$file, $op, &$instance, $widget) {
    switch ($op) {
      case 'init':
        // Add a custom callback function to be executed after the scripts have 
        // been initialized.
        $instance->callbacks['init_complete_handler'] = 'myCustomCallbackFunction';

        // Add a custom editabe tabledrawer. 
        $instance->elements['test'] => array(
          'class' => 'my-class', // The class for the td.
          'type' => 'text', // An editable textfield will be added. Values will be saved!
          'colspan' => 2, // Colspan for this td
          'title' => t('Description'), // This will be used in the th
          'add_separator' => TRUE, // Whether or not to put a separator between the colums in the thead.
          'contains_progressbar' = TRUE, // Whether or not the progressbar can be put here during upload.
        );
        break;
      case 'move_uploaded_file':
        global $user;
        $file->filepath = "files/$user->uid/"; // Files will be stored in an user folder
        break;
      case 'upload_complete':
        db_query("INSERT INTO {mymoduletable} (fid, filename) VALUES ('%s', '%s')", $file->fid, $file->filename);
        break;
    }
  }


BUGS:
--------------------------------------------------------------------------------

1. If the swfupload is loaded inside a collapsed fieldset, Firefox occasionally 
   crashes when the fieldset expanded. 

2. If you're getting 'IO Error #2038' errors, try pasting the following in your
   .htaccess file, or visit http://swfupload.org/forum/generaldiscussion/92.

     SecFilterEngine Off
     SecFilterScanPOST Off


KUDOS:
--------------------------------------------------------------------------------

Special thanks to Nathan Haug (quicksketch) for writing ImageField and helping
me out developing the SWFUpload module, and Morten Nielsen (minus) for
sponsoring the module.