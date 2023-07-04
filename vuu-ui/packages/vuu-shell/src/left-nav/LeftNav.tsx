import { Action, useLayoutProviderDispatch } from "@finos/vuu-layout";
import { LayoutResizeAction } from "@finos/vuu-layout/src/layout-reducer";
import cx from "classnames";
import { HTMLAttributes, useCallback, useRef } from "react";

import "./LeftNav.css";

const classBase = "vuuLeftNav";

interface LeftNavProps extends HTMLAttributes<HTMLDivElement> {
  "data-path"?: string;
  onResize?: (size: number) => void;
  open?: boolean;
}

export const LeftNav = ({
  "data-path": path,
  onResize,
  open = true,
  ...htmlAttributes
}: LeftNavProps) => {
  const dispatch = useLayoutProviderDispatch();
  const openRef = useRef(open);

  const toggleSize = useCallback(() => {
    openRef.current = !openRef.current;
    dispatch({
      type: Action.LAYOUT_RESIZE,
      path,
      size: openRef.current ? 240 : 80,
    } as LayoutResizeAction);
  }, [dispatch, path]);
  return (
    <div {...htmlAttributes} className={classBase}>
      <div className="vuuLeftNav-logo">
        <svg
          width="44"
          height="45"
          viewBox="0 0 44 45"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g clipPath="url(#clip0_217_6990)">
            <path
              d="M39.8642 15.5509L35.9196 7.58974L34.3369 6.85464L24.6235 22.0825L39.1628 30.618L42.3152 25.6347L39.8642 15.5509Z"
              fill="url(#paint0_linear_217_6990)"
            />
            <path
              d="M42.6246 24.8716C41.9199 25.9157 40.9625 26.824 39.767 27.4905C38.424 28.2396 36.9563 28.597 35.5081 28.597C32.7541 28.597 30.0715 27.3094 28.4466 24.9855L15.772 3.90967L15.7655 3.9206C13.3615 0.137431 8.25372 -1.13143 4.24754 1.10507C0.178173 3.37435 -1.20852 8.39359 1.14854 12.3125L18.3445 40.9095C19.1108 42.1846 20.1816 43.1834 21.4144 43.8764C21.4241 43.8826 21.4338 43.8889 21.4435 43.8951C21.4484 43.8982 21.4549 43.9013 21.4597 43.9045C22.0332 44.2228 22.6423 44.471 23.2725 44.6536C23.3194 44.6677 23.368 44.6817 23.415 44.6942C23.6418 44.7551 23.8702 44.8097 24.1019 44.8534C24.1456 44.8612 24.1894 44.8659 24.2331 44.8737C24.4194 44.9049 24.6073 44.9314 24.7952 44.9501C24.8698 44.9579 24.9443 44.9658 25.0188 44.9704C25.2342 44.9876 25.4497 44.9985 25.6668 45.0001C25.6781 45.0001 25.6895 45.0001 25.6992 45.0001C25.7024 45.0001 25.704 45.0001 25.7073 45.0001C25.7105 45.0001 25.7121 45.0001 25.7154 45.0001C25.9503 45.0001 26.1868 44.9876 26.4217 44.9689C26.4751 44.9642 26.5286 44.9595 26.5837 44.9533C26.8137 44.9299 27.0438 44.9002 27.2738 44.8596C27.277 44.8596 27.2803 44.8596 27.2835 44.8596C27.5362 44.8144 27.7889 44.7551 28.0384 44.6864C28.0546 44.6817 28.0692 44.677 28.0854 44.6723C28.4483 44.5709 28.8063 44.4445 29.1594 44.2931C29.1659 44.29 29.174 44.2868 29.1805 44.2837C29.4494 44.1682 29.7151 44.0418 29.9759 43.8967C30.24 43.75 30.491 43.5908 30.7308 43.4206C30.9398 43.2739 31.1407 43.1179 31.3367 42.9524C31.5748 42.7495 31.8 42.5373 32.009 42.3141C32.1661 42.1471 32.3168 41.9723 32.4609 41.7913C32.5079 41.732 32.5517 41.6711 32.5954 41.6118C32.6942 41.4807 32.7882 41.3465 32.8789 41.2091C32.9259 41.1373 32.9728 41.0671 33.0182 40.9953C33.036 40.9672 33.0555 40.9407 33.0717 40.9126L42.7153 24.8763H42.6214L42.6246 24.8716Z"
              fill="url(#paint1_linear_217_6990)"
            />
            <path
              d="M42.8402 16.4218L42.1112 15.2232L38.9636 9.58433L37.504 7.19644C37.2286 6.56123 36.579 6.11331 35.8176 6.11331C34.8083 6.11331 33.9919 6.90147 33.9919 7.87223C33.9919 8.20154 34.0907 8.50432 34.2543 8.76808L34.2349 8.78056L39.9048 18.0808C40.5884 19.2186 40.7715 20.5437 40.4199 21.8141C40.0684 23.0845 39.226 24.1458 38.045 24.806C37.2675 25.2398 36.3846 25.4693 35.4936 25.4693C33.6727 25.4693 31.9766 24.5281 31.0662 23.0143L22.9161 9.63271H22.9323L19.4899 3.90958L19.4834 3.92051C19.4235 3.8253 19.3538 3.73947 19.2907 3.64738L19.1935 3.48663C19.1935 3.48663 19.1854 3.49131 19.1821 3.49443C17.5654 1.27666 14.9799 0.0390178 12.3118 0.00936427V0H7.91199V0.02185C10.9851 -0.184164 14.0582 1.23296 15.7656 3.92051L15.7721 3.90958L28.4451 24.987C30.0699 27.3093 32.7542 28.5985 35.5066 28.5985C36.9548 28.5985 38.4225 28.2426 39.7655 27.4919C40.961 26.8255 41.9168 25.9156 42.6231 24.8731H42.717L42.6846 24.9261C43.1366 24.2347 43.4833 23.4731 43.7068 22.6615C44.2916 20.5452 43.9871 18.3352 42.8369 16.4234L42.8402 16.4218Z"
              fill="#F37880"
            />
            <g opacity="0.86">
              <path
                d="M34.2332 8.78212L39.9031 18.0824C40.5868 19.2202 40.7698 20.5452 40.4183 21.8156C40.2044 22.5897 39.8059 23.2858 39.2616 23.8617C39.9744 23.2343 40.4879 22.4243 40.7423 21.5035C41.0938 20.2331 40.9107 18.908 40.2271 17.7703L34.5572 8.46998L34.5767 8.4575C34.413 8.19374 34.3142 7.89096 34.3142 7.56165C34.3142 7.15586 34.4584 6.78285 34.6982 6.48476C34.2672 6.80626 33.9902 7.30881 33.9902 7.87379C33.9902 8.2031 34.0891 8.50588 34.2527 8.76964L34.2332 8.78212Z"
                fill="white"
              />
              <path
                d="M42.6917 24.9169L42.6863 24.9256C42.6863 24.9256 42.6899 24.9187 42.6935 24.9152C42.6935 24.9152 42.6935 24.9152 42.6935 24.9169H42.6917Z"
                fill="white"
              />
              <path
                d="M40.0911 27.1798C38.7481 27.9289 37.2804 28.2863 35.8322 28.2863C33.0782 28.2863 30.3955 26.9988 28.7707 24.6749L16.0961 3.59744L16.0896 3.60837C14.9281 1.78077 13.1364 0.543128 11.1422 0H7.91199V0.02185C10.9851 -0.184164 14.0582 1.23296 15.7656 3.92051L15.7721 3.90958L28.4451 24.987C30.0699 27.3093 32.7542 28.5985 35.5066 28.5985C36.9548 28.5985 38.4225 28.2426 39.7655 27.4919C40.4815 27.0924 41.1084 26.6055 41.6511 26.0561C41.1862 26.479 40.6662 26.8583 40.0894 27.1798H40.0911Z"
                fill="white"
              />
            </g>
          </g>
          <defs>
            <linearGradient
              id="paint0_linear_217_6990"
              x1="24.6235"
              y1="18.7363"
              x2="42.3152"
              y2="18.7363"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#4906A5" />
              <stop offset="1" stopColor="#D3423A" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_217_6990"
              x1="-2.35794e-05"
              y1="22.5009"
              x2="42.7186"
              y2="22.5009"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#7C06A5" />
              <stop offset="1" stopColor="#D3423A" />
            </linearGradient>
            <clipPath id="clip0_217_6990">
              <rect width="44" height="45" fill="white" />
            </clipPath>
          </defs>
        </svg>{" "}
      </div>
      <div className={`${classBase}-main`}>
        <ul className={`${classBase}-menu`}>
          <li
            className={cx(
              `${classBase}-menuitem`,
              `${classBase}-menuitem-active`
            )}
            data-icon="demo"
          >
            <span className={`${classBase}-menuitem-label`}>DEMO</span>
          </li>
          <li className={`${classBase}-menuitem`} data-icon="tables">
            <span className={`${classBase}-menuitem-label`}>VUU TABLES</span>
          </li>
          <li className={`${classBase}-menuitem`} data-icon="templates">
            <span className={`${classBase}-menuitem-label`}>
              LAYOUT TEMPLATES
            </span>
          </li>
          <li className={`${classBase}-menuitem`} data-icon="layouts">
            <span className={`${classBase}-menuitem-label`}>MY LAYOUTS</span>
          </li>
        </ul>
      </div>
      <div className="vuuLeftNav-buttonBar">
        <button
          className={cx("vuuLeftNav-toggleButton", {
            "vuuLeftNav-toggleButton-open": openRef.current,
            "vuuLeftNav-toggleButton-closed": !openRef.current,
          })}
          data-icon={openRef.current ? "chevron-left" : "chevron-right"}
          onClick={toggleSize}
        />
      </div>
    </div>
  );
};
