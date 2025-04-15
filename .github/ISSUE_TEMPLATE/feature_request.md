name: Feature Request
description: Suggest a new component or functionality
labels: [enhancement]
title: "[Feature] "
assignees: ''

body:

- type: textarea
  id: idea
  attributes:
  label: What's your idea?
  description: Describe what you'd like to see added or improved.
  validations:
  required: true

- type: dropdown
  id: priority
  attributes:
  label: Priority
  options: - Low - Medium - High
