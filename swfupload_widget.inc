<?php
// $Id: swfupload_widget.inc,v 1.2 2010/02/15 13:39:55 skilip Exp $

/**
 * @file
 * SWFUpload widget hooks and callbacks.
 */

/**
 * Implementation of CCK's hook_widget_settings($op = 'form').
 */
function swfupload_widget_settings_form($widget) {
  if (module_exists('imagefield')) {
    module_load_include('inc', 'imagefield', 'imagefield_widget');
    $form = imagefield_widget_settings_form($widget);
  }
  else {
    $form = module_invoke('filefield', 'widget_settings', 'form', $widget);
  }
  return $form;
}

/**
 * Implementation of CCK's hook_widget_settings($op = 'validate').
 */
function swfupload_widget_settings_validate($widget) {
  // Check that set resolutions are valid.
  foreach (array('min_resolution', 'max_resolution') as $resolution) {
    if (!empty($widget[$resolution]) && !preg_match('/^[0-9]+x[0-9]+$/', $widget[$resolution])) {
      form_set_error($resolution, t('Please specify a resolution in the format WIDTHxHEIGHT (e.g. 640x480).'));
    }
  }
}

/**
 * Implementation of CCK's hook_widget_settings($op = 'save').
 */
function swfupload_widget_settings_save($widget) {
  $filefield_settings = module_invoke('filefield', 'widget_settings', 'save', $widget);
  return array_merge($filefield_settings, array('max_resolution', 'min_resolution', 'alt',  'custom_alt', 'title', 'custom_title', 'title_type', 'default_image', 'use_default_image'));
}
