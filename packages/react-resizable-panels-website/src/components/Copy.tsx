import styles from "./Copy.module.css";

export default function Copy({
  className = "",
  code,
  hidden = false,
}: {
  className?: string;
  code: string;
  hidden?: boolean;
}) {
    if (hidden) {
        return null;
    }

  return (
    <button className={[styles.Copy, className].join(" ")} onClick={
        () => {
            navigator.clipboard.writeText(code).then(function() {
                document.getElementById('copyLabel').innerText = 'Copied!';
                setTimeout(function(){
                    document.getElementById('copyLabel').innerText = 'Copy';
                }, 3000);
            }, function(err) {
                console.error('Copy error: ', err);
            })
        }
    }>
        <svg xmlns="http://www.w3.org/2000/svg" height="14" width="14" viewBox="0 0 48 48"><path d="M8.75 45.15q-1.6 0-2.775-1.175Q4.8 42.8 4.8 41.2V11.3h3.95v29.9H32.2v3.95Zm7-6.95q-1.65 0-2.825-1.175Q11.75 35.85 11.75 34.2V6.7q0-1.6 1.175-2.775Q14.1 2.75 15.75 2.75h21.5q1.6 0 2.775 1.175Q41.2 5.1 41.2 6.7v27.5q0 1.65-1.175 2.825Q38.85 38.2 37.25 38.2Zm0-4h21.5V6.7h-21.5v27.5Zm0 0V6.7v27.5Z"/></svg>
        <span id="copyLabel">Copy</span>
    </button>
  );
}
