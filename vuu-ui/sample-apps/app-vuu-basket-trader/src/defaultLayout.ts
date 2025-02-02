import { LayoutJSON } from "@finos/vuu-layout";

export const defaultLayout: LayoutJSON = {
  id: "main-tabs",
  type: "Stack",
  props: {
    className: "vuuShell-mainTabs",
    TabstripProps: {
      allowAddTab: true,
      allowRenameTab: true,
      animateSelectionThumb: false,
      className: "vuuShellMainTabstrip",
      location: "main-tab",
    },
    preserve: true,
    active: 0,
  },
  children: [
    {
      type: "Placeholder",
      title: "Page 1",
    },
  ],
};
