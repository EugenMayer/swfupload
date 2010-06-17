<?php
// $Id:$

/**
 * @file
 * Include file for all functions required while using the CCK widget (e.g.: in node-edit forms).
 */

/**
 * Menu callback for menu item 'swfupload'.
 * This function is executed when SFWUpload.swf requests a file upload
 */
function swfupload_js() {
  $p = (object) $_POST;
  $op = $p->op;
  $file = json_decode($p->file);
  $instance = json_decode($p->instance);
  $widget = json_decode($p->widget);
  $file_path = $p->file_path;
  unset($p);

  switch ($op) {
    case 'init':
      // Add the default callback functions for the SWF Upload
      $instance->type = 'table';
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
        'init_complete_handler' => 'ref.initComplete',// This custom javascript callback function is used to place the markup inside the dom
      );
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
      break;
    case 'move_uploaded_file':
      $file->validators = array(
        'file_validate_extensions' => array($widget->file_extensions),
        'filefield_validate_image_resolution' => array($widget->max_resolution, $widget->min_resolution),
        'file_validate_size' => array($widget->max_filesize_per_file, $widget->max_filesize_per_file),
      );
      $file->file_path = $file_path;

      // Allow other modules to change the file_path an validators
      foreach (module_implements('swfupload') as $module) {
        $function = $module .'_swfupload';
        $function($file, $op, $instance, $widget);
      }

      $op = 'upload_complete';
      break;
  }
  // Allow other modules to change the returned data
  foreach (module_implements('swfupload') as $module) {
    $function = $module .'_swfupload';
    $function($file, $op, $instance, $widget);

    // We want to make sure the last column of each tablerow contains the 'cancel' or 'delete' button.
    if ($op == 'init') {
      $instance->elements['cancel'] = array('class' => 'last', 'type' => 'cancel');
    }
  }

  // Replace keys named 'class' to 'classname'
  if (is_array($instance->elements)) {
    array_walk($instance->elements, '_class_to_classname');
  }
  
  $p->op = $op;
  $p->file = $file;
  $p->file_path = $file_path;
  $p->instance = $instance;
  $p->widget = $widget;
  $p->messages = drupal_get_messages();
  echo drupal_to_js($p);
  exit(0);
}

/**
 * Theme function for the swfupload form element
 */
function theme_swfupload_widget($element) {
  drupal_add_css(drupal_get_path('module', 'swfupload') .'/swfupload.css');

  // Force the classes swfupload_button and disabled to be added to the button
  _form_set_class($element, array('swfupload_button', 'disabled'));
  $element['#attributes']['class'] = str_replace(' error', ' swfupload-error', $element['#attributes']['class']);

  $title = ($element['#title']) ? $element['#title'] : t('Upload new !file', array('!file' => ($element['#max_files'] > 1 ? t('file(s)') : t('file'))));
  $output[] = '<div id="'. $element['#id'] .'" '. drupal_attributes($element['#attributes']) .'>';
  $output[] = '  <div class="swfupload-wrapper">';
  $output[] = '    <div id="'. $element['#name'] .'-swfwrapper">&nbsp;</div>';
  $output[] = '  </div>';
  $output[] = '  <div class="left">&nbsp;</div>';
  $output[] = '  <div class="center">'. $title .'</div>';
  $output[] = '  <div class="right">&nbsp;</div><br />';
  $output[] = '</div>';
  if ($element['#description']) {
    $output[] = '  <div class="description">'. $element['#description'] .'</div>';
  }
  return join("\n", $output);
}

/**
 * Helper function to replace instance elements class keys to classname keys
 * Safari hangs if you use 'class' in javascript
 */
function _class_to_classname(&$element) {
  $element['classname'] = $element['class'];
  unset($element['class']);
}

/**
 * Create a thumbnail to be shown in the swfupload table
 */
function swfupload_thumb($file) {
  if (!is_file($file->filepath)) {
    return FALSE;
  }
  $short_path = preg_replace('/^' . preg_quote(file_directory_path(), '/') . '/', '', $file->filepath);
  $destination_path = file_directory_path() . '/imagefield_thumbs' . $short_path;

  $info = image_get_info($file->filepath);
  $size = explode('x', variable_get('swfupload_thumb_size', '32x32'));

  // Check if the destination image needs to be regenerated to match a new size.
  if (is_file($destination_path)) {
    $thumb_info = image_get_info($destination_path);
    if ($thumb_info['width'] != $size[0] && $thumb_info['height'] != $size[1] && ($info['width'] > $size[0] || $info['height'] > $size[1])) {
      unlink($destination_path);
    }
    else {
      return;
    }
  }

  // Ensure the destination directory exists and is writable.
  $directories = explode('/', $destination_path);
  array_pop($directories); // Remove the file itself.
  // Get the file system directory.
  $file_system = file_directory_path();
  foreach ($directories as $directory) {
    $full_path = isset($full_path) ? $full_path . '/' . $directory : $directory;
    // Don't check directories outside the file system path.
    if (strpos($full_path, $file_system) === 0) {
      field_file_check_directory($full_path, FILE_CREATE_DIRECTORY);
    }
  }

  // Create the thumbnail.
  if ($info['width'] <= $size[0] && $info['height'] <= $size[1]) {
    file_copy($file->filepath, $destination_path);
  }
  elseif (image_get_toolkit() && @image_scale($file->filepath, $destination_path, $size[0], $size[1])) {
    // Set permissions. This is done for us when using file_copy().
    @chmod($destination, 0664);
  }
  else {
    drupal_set_message(t('An image thumbnail was not able to be created.'), 'error');
    return FALSE;
  }
  return $destination_path;
}
